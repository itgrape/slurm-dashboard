package api

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"regexp"
	"slurm-dashboard/config"
	"slurm-dashboard/internal/services"
	"slurm-dashboard/internal/store"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type SbatchPayload struct {
	Script string `json:"script"`
}

// SbatchSubmitHandler 接收脚本内容，保存为临时文件，并使用sbatch提交
func SbatchSubmitHandler(cfg *config.Config, tokenStore *store.TokenStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		username, exists := c.Get("username")
		if !exists {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Username not found in context"})
			return
		}

		var payload SbatchPayload
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload", "details": err.Error()})
			return
		}

		// 使用 uuid 生成随机文件名，放在 /tmp 目录下
		scriptName := uuid.New().String()
		filePath := fmt.Sprintf("/tmp/%s.sh", scriptName)

		// 将脚本写入文件
		err := os.WriteFile(filePath, []byte(payload.Script), 0755)
		if err != nil {
			log.Printf("Failed to write temporary script file for user %s: %v", username, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create script file on server"})
			return
		}

		defer os.Remove(filePath)
		log.Printf("Created temporary script %s for user %s", filePath, username)

		command := fmt.Sprintf("sbatch %s", filePath)

		// 以用户身份执行 sbatch 命令
		output, err := services.ExecuteCommandAsUser(username.(string), command)
		if err != nil {
			log.Printf("Failed to execute sbatch command for user %s: %v", username, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to execute sbatch command"})
			return
		}

		re := regexp.MustCompile(`Submitted batch job (\d+)`)
		matches := re.FindStringSubmatch(output)

		if len(matches) < 2 {
			log.Printf("Failed to parse job ID from sbatch output for user %s. Output: %s", username, output)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse Job ID from sbatch output", "output": output})
			return
		}

		jobID := matches[1]
		log.Printf("Successfully submitted job %s for user %s", jobID, username)

		// 7. 返回成功响应
		c.JSON(http.StatusOK, gin.H{"job_id": jobID})
	}
}
