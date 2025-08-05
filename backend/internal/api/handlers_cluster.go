package api

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"slurm-dashboard/config"
	"slurm-dashboard/internal/models"
	"slurm-dashboard/internal/services"
	"slurm-dashboard/internal/store"

	"github.com/gin-gonic/gin"
)

type ClusterStatusResponse struct {
	Partitions []PartitionInfo `json:"partitions"`
	Nodes      []NodeStatus    `json:"nodes"`
	Errors     []string        `json:"errors"`
}

type PartitionInfo struct {
	Name  string   `json:"name"`
	Nodes []string `json:"nodes"`
}

type NodeStatus struct {
	Name          string    `json:"name"`
	State         []string  `json:"state"`
	Partitions    []string  `json:"partitions"`
	TotalCPUs     uint32    `json:"total_cpus"`
	AllocatedCPUs uint32    `json:"allocated_cpus"`
	AvailableCPUs uint32    `json:"available_cpus"`
	GPUs          []GPUInfo `json:"gpus"`
}

type GPUInfo struct {
	Type      string `json:"type"`
	Total     int    `json:"total"`
	Allocated int    `json:"allocated"`
	Available int    `json:"available"`
}

func GetClusterStatusHandler(cfg *config.Config, tokenStore *store.TokenStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		username, _ := c.Get("username")
		slurmToken, ok := tokenStore.Get(username.(string))
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Slurm session not found"})
			return
		}

		client := &http.Client{Timeout: 30 * time.Second}

		nodesData, err := fetchNodesData(client, cfg.SlurmAPIHost+"/slurm/v0.0.42/nodes", username.(string), slurmToken)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch nodes data", "details": err.Error()})
			return
		}

		response := processClusterDataFromNodes(nodesData)

		c.JSON(http.StatusOK, response)
	}
}

// GetClusterStatusByUserHandler 是一个新的 Handler，用于获取特定用户可见的集群状态。
// 它会过滤掉用户无权访问的分区以及所有以 'debug' 开头的分区。
func GetClusterStatusByUserHandler(cfg *config.Config, tokenStore *store.TokenStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		username, _ := c.Get("username")
		usernameStr := username.(string)

		slurmToken, ok := tokenStore.Get(usernameStr)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Slurm session not found"})
			return
		}

		client := &http.Client{Timeout: 30 * time.Second}

		// --- 并行获取节点数据和用户允许的分区 ---
		type nodesResult struct {
			data models.SlurmNodeResponse
			err  error
		}
		type partitionsResult struct {
			data []string
			err  error
		}

		nodesChan := make(chan nodesResult, 1)
		partitionsChan := make(chan partitionsResult, 1)

		go func() {
			data, err := fetchNodesData(client, cfg.SlurmAPIHost+"/slurm/v0.0.42/nodes", usernameStr, slurmToken)
			nodesChan <- nodesResult{data: data, err: err}
		}()

		go func() {
			data, err := getUserAllowedPartition(usernameStr)
			partitionsChan <- partitionsResult{data: data, err: err}
		}()

		nodesRes := <-nodesChan
		partitionsRes := <-partitionsChan
		// --- 数据获取结束 ---

		if nodesRes.err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch nodes data", "details": nodesRes.err.Error()})
			return
		}
		if partitionsRes.err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user allowed partitions", "details": partitionsRes.err.Error()})
			return
		}

		// 使用新的处理函数来整合和过滤数据
		response := processAndFilterClusterData(nodesRes.data, partitionsRes.data)

		c.JSON(http.StatusOK, response)
	}
}

func GetPartitionsHandler(cfg *config.Config, tokenStore *store.TokenStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		username, _ := c.Get("username")
		response, err := getUserAllowedPartition(username.(string))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch partitions data", "details": err.Error()})
		}
		c.JSON(http.StatusOK, response)
	}
}

// processAndFilterClusterData 根据用户权限和规则过滤集群数据
func processAndFilterClusterData(nodesData models.SlurmNodeResponse, allowedPartitions []string) ClusterStatusResponse {
	var response ClusterStatusResponse

	// 1. 创建一个用户允许的分区集合(Set)，以便快速查找，并排除 debug 分区
	allowedPartitionsSet := make(map[string]struct{})
	for _, p := range allowedPartitions {
		if !strings.HasPrefix(p, "debug") {
			allowedPartitionsSet[p] = struct{}{}
		}
	}

	// 用于构建最终分区列表的 map
	finalPartitionMap := make(map[string]map[string]bool)

	// 2. 遍历所有节点，并过滤每个节点关联的分区列表
	for _, n := range nodesData.Nodes {
		filteredNodePartitions := make([]string, 0)
		for _, partName := range n.Partitions {
			// 检查该分区是否在用户的允许集合中
			if _, ok := allowedPartitionsSet[partName]; ok {
				filteredNodePartitions = append(filteredNodePartitions, partName)

				// 如果分区可见，则将其加入到最终的分区-节点关系图中
				if _, mapOk := finalPartitionMap[partName]; !mapOk {
					finalPartitionMap[partName] = make(map[string]bool)
				}
				finalPartitionMap[partName][n.Name] = true
			}
		}

		// 将节点信息添加到响应中，但其分区列表是过滤后的
		response.Nodes = append(response.Nodes, NodeStatus{
			Name:          n.Name,
			State:         n.State,
			Partitions:    filteredNodePartitions, // 使用过滤后的分区列表
			TotalCPUs:     n.TotalCPUs,
			AllocatedCPUs: n.AllocatedCPUs,
			AvailableCPUs: n.TotalCPUs - n.AllocatedCPUs,
			GPUs:          parseGres(n.Gres, n.GresUsed),
		})
	}

	// 3. 根据过滤后的分区-节点关系图，构建最终的响应分区列表
	for partName, nodes := range finalPartitionMap {
		var nodeList []string
		for nodeName := range nodes {
			nodeList = append(nodeList, nodeName)
		}
		response.Partitions = append(response.Partitions, PartitionInfo{
			Name:  partName,
			Nodes: nodeList,
		})
	}

	return response
}

func fetchNodesData(client *http.Client, url, username, token string) (models.SlurmNodeResponse, error) {
	var result models.SlurmNodeResponse
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return result, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("X-SLURM-USER-NAME", username)
	req.Header.Set("X-SLURM-USER-TOKEN", token)
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return result, fmt.Errorf("request to slurm failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return result, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return result, fmt.Errorf("slurm api returned status %d: %s", resp.StatusCode, string(body))
	}

	if err := json.Unmarshal(body, &result); err != nil {
		log.Printf("Failed to unmarshal JSON for %s. Raw data: %s. Error: %v", url, string(body), err)
		return result, fmt.Errorf("failed to unmarshal json: %w", err)
	}
	return result, nil
}

func processClusterDataFromNodes(nodesData models.SlurmNodeResponse) ClusterStatusResponse {
	var response ClusterStatusResponse

	partitionMap := make(map[string]map[string]bool)

	for _, n := range nodesData.Nodes {
		response.Nodes = append(response.Nodes, NodeStatus{
			Name:          n.Name,
			State:         n.State,
			Partitions:    n.Partitions,
			TotalCPUs:     n.TotalCPUs,
			AllocatedCPUs: n.AllocatedCPUs,
			AvailableCPUs: n.TotalCPUs - n.AllocatedCPUs,
			GPUs:          parseGres(n.Gres, n.GresUsed),
		})

		for _, partName := range n.Partitions {
			if _, ok := partitionMap[partName]; !ok {
				partitionMap[partName] = make(map[string]bool)
			}
			partitionMap[partName][n.Name] = true
		}
	}

	for partName, nodes := range partitionMap {
		var nodeList []string
		for nodeName := range nodes {
			nodeList = append(nodeList, nodeName)
		}
		// !! 修正: 不再添加 State 字段
		response.Partitions = append(response.Partitions, PartitionInfo{
			Name:  partName,
			Nodes: nodeList,
		})
	}

	return response
}

// parseGres 解析GRES字符串以获取GPU信息
func parseGres(gres, gresUsed string) []GPUInfo {
	gpuMap := make(map[string]*GPUInfo)

	// 解析总资源: "gpu:A100:4,gpu:V100:2"
	totalParts := strings.Split(gres, ",")
	for _, part := range totalParts {
		// gres/gpu:a100:8
		if !strings.HasPrefix(part, "gpu:") {
			// 也可能是 gres/gpu:a100:8 这种格式
			if !strings.HasPrefix(part, "gres/gpu:") {
				continue
			}
		}

		gpuInfo := strings.Split(part, ":")
		if len(gpuInfo) < 2 {
			continue
		}

		gpuType := "gpu" // 默认类型
		countStr := gpuInfo[1]

		if len(gpuInfo) > 2 {
			gpuType = gpuInfo[1]
			countStr = gpuInfo[2]
		}

		count, err := strconv.Atoi(countStr)
		if err != nil {
			continue
		}

		if _, ok := gpuMap[gpuType]; !ok {
			gpuMap[gpuType] = &GPUInfo{Type: gpuType}
		}
		gpuMap[gpuType].Total += count
	}

	// 解析已用资源: "gpu:A100:1(IDX:0),gpu:V100:1"
	usedParts := strings.Split(gresUsed, ",")
	for _, part := range usedParts {
		if !strings.HasPrefix(part, "gpu:") {
			if !strings.HasPrefix(part, "gres/gpu:") {
				continue
			}
		}

		// 去掉(IDX...)部分
		if idx := strings.Index(part, "("); idx != -1 {
			part = part[:idx]
		}

		gpuInfo := strings.Split(part, ":")
		if len(gpuInfo) < 2 {
			continue
		}

		gpuType := "gpu"
		countStr := gpuInfo[1]

		if len(gpuInfo) > 2 {
			gpuType = gpuInfo[1]
			countStr = gpuInfo[2]
		}

		count, err := strconv.Atoi(countStr)
		if err != nil {
			continue
		}

		if _, ok := gpuMap[gpuType]; !ok {
			gpuMap[gpuType] = &GPUInfo{Type: gpuType}
		}
		gpuMap[gpuType].Allocated += count
	}

	var result []GPUInfo
	for _, gpu := range gpuMap {
		gpu.Available = gpu.Total - gpu.Allocated
		result = append(result, *gpu)
	}
	return result
}

// 获取用户允许的分区
func getUserAllowedPartition(username string) ([]string, error) {
	output1, err := services.ExecuteCommandAsUser("root", "scontrol show partition | grep -E 'PartitionName|AllowAccounts'")
	if err != nil {
		return nil, fmt.Errorf("failed to get partition info: %w", err)
	}
	partitionAllowdInfo, err := parsePartitionAllowedOutput(output1)
	if err != nil {
		return nil, fmt.Errorf("failed to parse partition info: %w", err)
	}

	sacctmgrCmd := fmt.Sprintf("sacctmgr -nP show associations where user=%s format=Account", username)
	output2, err := services.ExecuteCommandAsUser(username, sacctmgrCmd)
	if err != nil {
		return nil, fmt.Errorf("failed to get user account info for %s: %w", username, err)
	}
	userAccountsSlice := parseToSlice(output2)

	userAccountSet := make(map[string]struct{})
	for _, acc := range userAccountsSlice {
		userAccountSet[acc] = struct{}{}
	}

	allowedPartitions := make([]string, 0)
	for partitionName, allowed := range partitionAllowdInfo {
		// 情况一：分区对所有账户开放
		if len(allowed.AllowAccounts) == 1 && allowed.AllowAccounts[0] == "ALL" {
			allowedPartitions = append(allowedPartitions, partitionName)
			continue // 处理下一个分区
		}

		// 情况二：检查用户账户与分区允许的账户是否有交集
		for _, partitionAccount := range allowed.AllowAccounts {
			// 进行精确匹配
			if _, ok := userAccountSet[partitionAccount]; ok {
				// 找到了一个匹配项，该用户有权访问此分区
				allowedPartitions = append(allowedPartitions, partitionName)
				break // 一旦找到匹配，就无需再检查该分区的其他账户，跳出内层循环
			}
		}
	}

	return allowedPartitions, nil
}

type PartitionAllow struct {
	AllowGroups   []string
	AllowAccounts []string
	AllowQos      []string
}

// 解析 scontrol show partition | grep -E 'PartitionName|AllowAccounts' 的输出
// 返回值 map，key 为 PartitionName，value 为 PartitionAllow 结构体
func parsePartitionAllowedOutput(info string) (map[string]PartitionAllow, error) {
	// 初始化最终结果的 map
	partitions := make(map[string]PartitionAllow)
	// 按行分割字符串
	lines := strings.Split(info, "\n")

	var currentPartitionName string

	for _, line := range lines {
		trimmedLine := strings.TrimSpace(line)
		if trimmedLine == "" {
			continue
		}

		// 检查这一行是否是定义 PartitionName 的行
		if strings.HasPrefix(trimmedLine, "PartitionName=") {
			parts := strings.SplitN(trimmedLine, "=", 2)
			if len(parts) == 2 {
				currentPartitionName = parts[1]
				partitions[currentPartitionName] = PartitionAllow{}
			}
		} else if currentPartitionName != "" {
			// 如果这一行不是 PartitionName 定义行，并且我们已经有了一个当前的分区名
			// 那么这一行就是包含 AllowAccounts 等信息的行

			// 获取当前分区的结构体引用，以便更新
			currentPA := partitions[currentPartitionName]

			// 按空格分割字段，例如 "AllowGroups=ALL", "AllowAccounts=...", "AllowQos=ALL"
			fields := strings.Fields(trimmedLine)
			for _, field := range fields {
				// 按 "=" 分割键和值
				kv := strings.SplitN(field, "=", 2)
				if len(kv) == 2 {
					key, valueStr := kv[0], kv[1]
					// 将值字符串按逗号分割成切片
					values := strings.Split(valueStr, ",")

					// 根据键的名称，填充到结构体的对应字段
					switch key {
					case "AllowGroups":
						currentPA.AllowGroups = values
					case "AllowAccounts":
						currentPA.AllowAccounts = values
					case "AllowQos":
						currentPA.AllowQos = values
					}
				}
			}
			// 将更新后的结构体存回 map
			partitions[currentPartitionName] = currentPA
			// 重置当前分区名，防止后续的无效行错误地关联
			currentPartitionName = ""
		}
	}

	return partitions, nil
}

// parseToSlice 将一个由换行符分隔的字符串解析为一个字符串切片。
// 它会去除每个元素周围的空白，并忽略空行。
func parseToSlice(output string) []string {
	// 1. 初始化一个用于存放结果的空切片
	var result []string

	// 2. 使用换行符 "\n" 分割原始字符串
	lines := strings.Split(output, "\n")

	// 3. 遍历分割后的每一行
	for _, line := range lines {
		// 4. 去除每一行开头和结尾的空白字符
		trimmedLine := strings.TrimSpace(line)

		// 5. 如果清理后的行不是空字符串，则将其添加到结果切片中
		if trimmedLine != "" {
			result = append(result, trimmedLine)
		}
	}

	return result
}
