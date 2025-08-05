package api

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"os/user"
	"strconv"
	"syscall"
	"time"

	"slurm-dashboard/config"
	"slurm-dashboard/internal/auth"
	"slurm-dashboard/internal/store"

	"github.com/creack/pty"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

// SallocPayload 定义了创建salloc会话的请求体
type SallocPayload struct {
	TaskName  string `json:"task_name"`
	Partition string `json:"partition"`
	GPUCount  int    `json:"gpu_count"`
	CPUCount  int    `json:"cpu_count"`
}

// HandleCreateSallocSession 创建一个新的 salloc 会话 (POST)
func HandleCreateSallocSession(cfg *config.Config, sessionStore *store.SessionStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		username, _ := c.Get("username")

		var payload SallocPayload
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload", "details": err.Error()})
			return
		}

		// 获取用户信息并设置命令执行身份
		osUser, err := user.Lookup(username.(string))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to lookup user"})
			return
		}
		uid, _ := strconv.Atoi(osUser.Uid)
		gid, _ := strconv.Atoi(osUser.Gid)

		// 构建 salloc 命令
		args := []string{}
		args = append(args, "--ntasks-per-node", "1")
		if payload.TaskName != "" {
			args = append(args, "--job-name", payload.TaskName)
		}
		if payload.Partition != "" {
			args = append(args, "--partition", payload.Partition)
		}
		if payload.GPUCount > 0 {
			args = append(args, "--gpus", strconv.Itoa(payload.GPUCount))
		}
		if payload.CPUCount > 0 {
			args = append(args, "--cpus-per-task", strconv.Itoa(payload.CPUCount))
		}

		cmd := exec.Command("salloc", args...)
		cmd.Dir = osUser.HomeDir
		cmd.SysProcAttr = &syscall.SysProcAttr{
			Credential: &syscall.Credential{Uid: uint32(uid), Gid: uint32(gid)},
		}
		// 注入正确的环境变量
		cmd.Env = []string{
			"TERM=xterm",
			fmt.Sprintf("HOME=%s", osUser.HomeDir),
			fmt.Sprintf("USER=%s", username.(string)),
			fmt.Sprintf("LOGNAME=%s", username.(string)),
			fmt.Sprintf("PATH=%s", os.Getenv("PATH")),
		}

		// 同步方式启动带 PTY 的命令
		ptmx, err := pty.Start(cmd)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start salloc process", "details": err.Error()})
			return
		}

		sessionID := uuid.New().String()
		session := &store.InteractiveSession{
			ID:       sessionID,
			Username: username.(string),
			Cmd:      cmd,
			Pty:      ptmx,
		}
		sessionStore.Add(session)
		log.Printf("Started salloc process for user %s", username)

		go func() {
			cmd.Wait()
			ptmx.Close()
			log.Printf("Salloc session %s for user %s has terminated.", sessionID, username)
			time.AfterFunc(1*time.Minute, func() {
				sessionStore.Remove(sessionID)
			})
		}()

		// 立即返回会话ID
		c.JSON(http.StatusAccepted, gin.H{"session_id": sessionID})
	}
}

// HandleAttachSallocSession 连接到一个已存在的 salloc 会话 (WebSocket GET)
func HandleAttachSallocSession(cfg *config.Config, sessionStore *store.SessionStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		sessionID := c.Param("session_id")

		// 手动认证
		tokenString := c.Query("token")
		claims := &auth.CustomClaims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			return []byte(cfg.JWTSecretKey), nil
		})
		if err != nil || !token.Valid {
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}
		username := claims.Username

		// 查找会话
		session, ok := sessionStore.Get(sessionID)
		if !ok {
			c.AbortWithStatus(http.StatusNotFound)
			return
		}

		// 授权：确保连接的用户是创建会话的用户
		if session.Username != username {
			c.AbortWithStatus(http.StatusForbidden)
			return
		}

		// 升级到 WebSocket
		ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("Failed to upgrade attach connection for session %s: %v", sessionID, err)
			return
		}
		defer ws.Close()
		log.Printf("User %s attached to salloc session %s", username, sessionID)

		pty := session.GetPty()
		if pty == nil {
			log.Printf("FATAL: PTY is nil for session %s despite synchronous start.", sessionID)
			return
		}

		go func() {
			for {
				_, message, err := ws.ReadMessage()
				if err != nil {
					break
				}
				if _, err := session.Pty.Write(message); err != nil {
					break
				}
			}
		}()
		buffer := make([]byte, 4096)
		for {
			n, err := session.Pty.Read(buffer)
			if err != nil {
				log.Printf("PTY for session %s closed: %v", sessionID, err)
				break
			}
			if err := ws.WriteMessage(websocket.BinaryMessage, buffer[:n]); err != nil {
				log.Printf("Failed to write to WebSocket for session %s: %v", sessionID, err)
				break
			}
		}

		log.Printf("User %s detached from salloc session %s", username, sessionID)
	}
}
