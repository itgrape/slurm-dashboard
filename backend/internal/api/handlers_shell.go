package api

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"os/user"

	"slurm-dashboard/config"
	"slurm-dashboard/internal/auth"

	"github.com/creack/pty"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
)

// 将 http 升级为 WebSocket
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// HandleShell 负责处理WebSocket Shell请求
func ShellHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString := c.Query("token")
		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Token is required"})
			return
		}
		claims := &auth.CustomClaims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			return []byte(cfg.JWTSecretKey), nil
		})
		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			return
		}
		username := claims.Username
		log.Printf("Shell access requested for user: %s", username)

		ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("Failed to upgrade connection for user %s: %v", username, err)
			return
		}
		defer ws.Close()

		// 验证用户是否存在于系统上
		osUser, err := user.Lookup(username)
		if err != nil {
			log.Printf("Failed to lookup user %s: %v", username, err)
			ws.WriteMessage(websocket.TextMessage, []byte("Error: Cannot find user on the system."))
			return
		}

		// 使用 `su` 来为指定用户启动一个完整的登录Shell
		cmd := exec.Command("su", "-", username)

		// 注入正确的环境变量
		cmd.Env = []string{
			"TERM=xterm",
			fmt.Sprintf("HOME=%s", osUser.HomeDir),
			fmt.Sprintf("USER=%s", username),
			fmt.Sprintf("LOGNAME=%s", username),
			fmt.Sprintf("PATH=%s", os.Getenv("PATH")),
		}

		ptmx, err := pty.Start(cmd)
		if err != nil {
			log.Printf("Failed to start pty with su for user %s: %v", username, err)
			ws.WriteMessage(websocket.TextMessage, []byte("Error: Failed to start shell process."))
			return
		}
		defer ptmx.Close()
		defer cmd.Process.Kill()

		go func() {
			buf := make([]byte, 1024)
			for {
				n, err := ptmx.Read(buf)
				if err != nil {
					log.Printf("Read from pty for user %s failed: %v", username, err)
					return
				}
				if err := ws.WriteMessage(websocket.BinaryMessage, buf[:n]); err != nil {
					log.Printf("Write to websocket for user %s failed: %v", username, err)
					return
				}
			}
		}()

		for {
			_, message, err := ws.ReadMessage()
			if err != nil {
				log.Printf("Read error from websocket for user %s: %v. Terminating shell.", username, err)
				break
			}
			if _, err := ptmx.Write(message); err != nil {
				log.Printf("Write error to pty for user %s: %v. Terminating shell.", username, err)
				break
			}
		}

		log.Printf("Shell session terminated for user: %s", username)
	}
}
