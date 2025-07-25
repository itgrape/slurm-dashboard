package api

import (
	"net/http"
	"path"
	"slurm-dashboard/config"
	"slurm-dashboard/internal/store"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func NewRouter(cfg *config.Config, tokenStore *store.TokenStore, sessionStore *store.SessionStore) *gin.Engine {
	router := gin.Default()

	// CORS 配置
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowAllOrigins = true
	corsConfig.AllowHeaders = append(corsConfig.AllowHeaders, "Authorization")
	router.Use(cors.New(corsConfig))

	// 静态文件服务
	router.StaticFS("/assets", http.Dir("./static/assets"))
	router.NoRoute(func(c *gin.Context) {
		if !strings.HasPrefix(c.Request.URL.Path, "/api/") {
			c.File(path.Join("./static", "index.html"))
		} else {
			c.JSON(http.StatusNotFound, gin.H{"error": "API route not found"})
		}
	})

	// 公开的路由
	router.POST("/api/login", LoginHandler(cfg, tokenStore))

	// 独立认证的路由
	router.GET("/api/v1/shell", ShellHandler(cfg))
	router.GET("/api/v1/salloc/interactive/:session_id/attach", HandleAttachSallocSession(cfg, sessionStore))

	// 受保护的API v1路由组
	apiV1 := router.Group("/api/v1")
	apiV1.Use(AuthMiddleware(cfg))
	{
		apiV1.GET("/cluster/status", GetClusterStatusHandler(cfg, tokenStore))
		apiV1.GET("/jobs", GetJobsHandler(cfg, tokenStore))
		jobGroup := apiV1.Group("/job")
		{
			jobGroup.POST("/submit", SubmitJobHandler(cfg, tokenStore))
			jobGroup.POST("/allocate", AllocateJobHandler(cfg, tokenStore))
			jobGroup.GET("/:job_id", HandleGetJobByID(cfg, tokenStore))
			jobGroup.DELETE("/:job_id", HandleDeleteJob(cfg, tokenStore))
			jobGroup.GET("/connect/:job_id", HandleGetJobConnectLog(cfg, tokenStore))
		}

		apiV1.POST("/salloc/interactive", HandleCreateSallocSession(cfg, sessionStore))
		apiV1.POST("/sbatch", SbatchSubmitHandler(cfg, tokenStore))
	}

	return router
}
