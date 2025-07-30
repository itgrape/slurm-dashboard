package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/user"
	"path/filepath"
	"strings"
	"time"

	"slurm-dashboard/config"
	"slurm-dashboard/internal/models"
	"slurm-dashboard/internal/store"

	"github.com/gin-gonic/gin"
)

// GetJobsHandler 负责处理获取作业列表的请求，并支持按用户名和状态筛选
func GetJobsHandler(cfg *config.Config, tokenStore *store.TokenStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1. 从 context 获取认证信息
		username, _ := c.Get("username")
		slurmToken, ok := tokenStore.Get(username.(string))
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Slurm session not found, please login again."})
			return
		}

		// 2. 从查询参数获取筛选条件
		filterUsername := c.Query("username")
		filterState := c.Query("state")
		log.Printf("Fetching jobs with filters: username=%s, state=%s", filterUsername, filterState)

		// 3. 从 Slurm 获取所有作业数据
		client := &http.Client{Timeout: 30 * time.Second}
		targetURL := cfg.SlurmAPIHost + "/slurm/v0.0.42/jobs"

		req, err := http.NewRequest("GET", targetURL, nil)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create request"})
			return
		}
		req.Header.Set("X-SLURM-USER-NAME", username.(string))
		req.Header.Set("X-SLURM-USER-TOKEN", slurmToken)
		req.Header.Set("Accept", "application/json")

		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Failed to reach Slurm API"})
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			bodyBytes, _ := io.ReadAll(resp.Body)
			c.Data(resp.StatusCode, "application/json", bodyBytes)
			return
		}

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read response from Slurm API"})
			return
		}

		// 4. 将JSON数据解析到我们的struct中
		var jobResponse models.SlurmJobResponse
		if err := json.Unmarshal(body, &jobResponse); err != nil {
			log.Printf("Failed to parse jobs JSON: %v", err) // 打印详细的解析错误
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse jobs JSON from Slurm API"})
			return
		}

		// 5. 在Go代码中执行过滤 (已更新过滤逻辑)
		var filteredJobs []models.SlurmJobInfo
		for _, job := range jobResponse.Jobs {
			matchUser := (filterUsername == "" || job.UserName == filterUsername)

			// 检查 JobState 数组是否包含筛选的状态
			// 通常我们只关心第一个状态
			var matchState bool
			if filterState == "" {
				matchState = true
			} else {
				if len(job.JobState) > 0 && job.JobState[0] == filterState {
					matchState = true
				}
			}

			if matchUser && matchState {
				filteredJobs = append(filteredJobs, job)
			}
		}
		log.Printf("Total jobs fetched: %d, jobs after filtering: %d", len(jobResponse.Jobs), len(filteredJobs))

		// 6. 将过滤后的结果返回给前端
		finalResponse := gin.H{
			"jobs": filteredJobs,
		}
		c.JSON(http.StatusOK, finalResponse)
	}
}

// HandleGetJobByID 负责根据作业ID获取单个作业的详细信息
func HandleGetJobByID(cfg *config.Config, tokenStore *store.TokenStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1. 身份验证和Token获取
		username, _ := c.Get("username")
		slurmToken, ok := tokenStore.Get(username.(string))
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Slurm session not found"})
			return
		}

		// 2. 从URL路径中获取 job_id 并验证
		jobId := c.Param("job_id")
		if jobId == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Job ID is required"})
			return
		}
		log.Printf("Received get job request for job %s by user %s", jobId, username)

		// 3. 将请求代理到真正的Slurm API
		client := &http.Client{Timeout: 30 * time.Second}
		targetURL := fmt.Sprintf("%s/slurm/v0.0.42/job/%s", cfg.SlurmAPIHost, jobId)

		// 创建一个新的GET请求
		req, err := http.NewRequest("GET", targetURL, nil)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create get job request"})
			return
		}

		// 4. 设置必要的Header
		req.Header.Set("X-SLURM-USER-NAME", username.(string))
		req.Header.Set("X-SLURM-USER-TOKEN", slurmToken)
		req.Header.Set("Accept", "application/json")

		// 5. 发送请求并代理响应
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Failed to reach Slurm API for getting job"})
			return
		}
		defer resp.Body.Close()

		responseBody, err := io.ReadAll(resp.Body)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read response from Slurm API"})
			return
		}

		// 将Slurm API的响应状态码和响应体原样返回给前端
		c.Data(resp.StatusCode, resp.Header.Get("Content-Type"), responseBody)
	}
}

// HandleDeleteJob 负责处理取消作业的DELETE请求
func HandleDeleteJob(cfg *config.Config, tokenStore *store.TokenStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1. 身份验证和Token获取
		username, _ := c.Get("username")
		slurmToken, ok := tokenStore.Get(username.(string))
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Slurm session not found"})
			return
		}

		// 2. 从URL路径中获取 job_id 并验证
		jobId := c.Param("job_id")
		if jobId == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Job ID is required"})
			return
		}
		log.Printf("Received job cancellation request for job %s by user %s", jobId, username)

		// 3. 将请求代理到真正的Slurm API
		client := &http.Client{Timeout: 30 * time.Second}
		// 构造包含 job_id 的目标URL
		targetURL := fmt.Sprintf("%s/slurm/v0.0.42/job/%s", cfg.SlurmAPIHost, jobId)

		// 创建一个新的DELETE请求
		req, err := http.NewRequest("DELETE", targetURL, nil)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create cancellation request"})
			return
		}

		// 4. 设置必要的Header
		req.Header.Set("X-SLURM-USER-NAME", username.(string))
		req.Header.Set("X-SLURM-USER-TOKEN", slurmToken)
		req.Header.Set("Accept", "application/json")

		// 5. 发送请求并代理响应
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Failed to reach Slurm API for job cancellation"})
			return
		}
		defer resp.Body.Close()

		responseBody, err := io.ReadAll(resp.Body)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read response from Slurm API"})
			return
		}

		// 将Slurm API的响应状态码和响应体原样返回给前端
		c.Data(resp.StatusCode, resp.Header.Get("Content-Type"), responseBody)
	}
}

// HandleGetJobConnectLog 读取并返回用户特定作业的连接方式日志
func HandleGetJobConnectLog(cfg *config.Config, tokenStore *store.TokenStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1. 从 context 获取已认证的用户名
		username, exists := c.Get("username")
		if !exists {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Username not found in context"})
			return
		}

		// 2. 从URL路径中获取 job_id 并验证
		jobId := c.Param("job_id")
		if jobId == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Job ID is required"})
			return
		}

		// 3. 查找用户的家目录
		osUser, err := user.Lookup(username.(string))
		if err != nil {
			log.Printf("Failed to lookup user '%s': %v", username, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not find user on the server"})
			return
		}
		homeDir := osUser.HomeDir

		// 4. 构造完整的文件路径
		fileName := fmt.Sprintf(cfg.JobConnectLogPattern, jobId)
		filePath := filepath.Join(homeDir, fileName)
		log.Printf("Attempting to read log file for user %s: %s", username, filePath)

		// 5. 读取文件内容
		content, err := os.ReadFile(filePath)
		if err != nil {
			// 如果文件不存在，返回 404 Not Found
			if os.IsNotExist(err) {
				c.JSON(http.StatusNotFound, gin.H{"error": "Log file not found"})
				return
			}
			// 其他错误（如权限问题），返回 500 Internal Server Error
			log.Printf("Failed to read file %s: %v", filePath, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read log file"})
			return
		}

		// 6. 成功读取，将文件内容返回
		c.JSON(http.StatusOK, gin.H{"content": string(content)})
	}
}

// HandleGetJobInfoLog 读取并返回用户特定作业的断开原因日志，作为前端的消息
func HandleGetAllJobInfoLogs(cfg *config.Config, tokenStore *store.TokenStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1. 从 context 获取已认证的用户名
		username, exists := c.Get("username")
		if !exists {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Username not found in context"})
			return
		}

		// 2. 查找用户的家目录
		osUser, err := user.Lookup(username.(string))
		if err != nil {
			log.Printf("Failed to lookup user '%s': %v", username, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not find user on the server"})
			return
		}
		homeDir := osUser.HomeDir

		// 3. 构造日志文件所在的目录路径
		// 假设 JobInfoLogPattern 是 ".slurm/info-%s.log"，我们从中提取目录部分 ".slurm"
		logDir := filepath.Dir(cfg.JobInfoLogPattern)
		fullLogDirPath := filepath.Join(homeDir, logDir)

		// 4. 读取目录中的所有文件
		files, err := os.ReadDir(fullLogDirPath)
		if err != nil {
			// 如果目录不存在，这不算是一个服务端错误，而是没有日志文件
			if os.IsNotExist(err) {
				log.Printf("Log directory not found for user %s: %s", username, fullLogDirPath)
				c.JSON(http.StatusOK, gin.H{"num": 0, "infos": gin.H{}})
				return
			}
			log.Printf("Failed to read log directory %s: %v", fullLogDirPath, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read log directory"})
			return
		}

		// 5. 准备从文件名中解析 Job ID 所需的前缀和后缀
		basePattern := filepath.Base(cfg.JobInfoLogPattern) // "info-%s.log"
		parts := strings.Split(basePattern, "%s")
		prefix := parts[0] // "info-"
		suffix := parts[1] // ".log"

		infos := make(map[string]string)

		// 6. 遍历文件，筛选、解析并读取内容
		for _, file := range files {
			if file.IsDir() {
				continue // 跳过子目录
			}
			fileName := file.Name()
			if strings.HasPrefix(fileName, prefix) && strings.HasSuffix(fileName, suffix) {
				// 提取 Job ID
				jobID := strings.TrimSuffix(strings.TrimPrefix(fileName, prefix), suffix)
				if jobID == "" {
					continue
				}

				// 读取文件内容
				filePath := filepath.Join(fullLogDirPath, fileName)
				content, err := os.ReadFile(filePath)
				if err != nil {
					log.Printf("Failed to read log file %s: %v", filePath, err)
					// 如果某个文件读取失败，我们可以跳过它，或者在infos中记录一个错误
					infos[jobID] = fmt.Sprintf("Error reading file: %v", err)
				} else {
					infos[jobID] = string(content)
				}
			}
		}

		// 7. 返回最终结果
		c.JSON(http.StatusOK, gin.H{
			"num":   len(infos),
			"infos": infos,
		})
	}
}

func genericPostProxyHandler(cfg *config.Config, tokenStore *store.TokenStore, slurmEndpoint string) gin.HandlerFunc {
	return func(c *gin.Context) {
		username, _ := c.Get("username")
		slurmToken, ok := tokenStore.Get(username.(string))
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Slurm session not found"})
			return
		}

		requestBody, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read request body"})
			return
		}
		log.Printf("Received POST request for user %s, proxying to %s", username, slurmEndpoint)

		client := &http.Client{Timeout: 30 * time.Second}
		targetURL := cfg.SlurmAPIHost + slurmEndpoint

		req, err := http.NewRequest("POST", targetURL, bytes.NewBuffer(requestBody))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create proxy request"})
			return
		}

		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-SLURM-USER-NAME", username.(string))
		req.Header.Set("X-SLURM-USER-TOKEN", slurmToken)
		req.Header.Set("Accept", "application/json")

		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "Failed to reach Slurm API endpoint"})
			return
		}
		defer resp.Body.Close()

		responseBody, err := io.ReadAll(resp.Body)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read response from Slurm API"})
			return
		}

		c.Data(resp.StatusCode, resp.Header.Get("Content-Type"), responseBody)
	}
}

func SubmitJobHandler(cfg *config.Config, tokenStore *store.TokenStore) gin.HandlerFunc {
	return genericPostProxyHandler(cfg, tokenStore, "/slurm/v0.0.42/job/submit")
}

func AllocateJobHandler(cfg *config.Config, tokenStore *store.TokenStore) gin.HandlerFunc {
	return genericPostProxyHandler(cfg, tokenStore, "/slurm/v0.0.42/job/allocate")
}
