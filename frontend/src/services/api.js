import axios from "axios";

// 创建axios实例
const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL,
    timeout: 20000,
    headers: {
        "Content-Type": "application/json",
    },
});

// 请求拦截器 - 添加token到请求头
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("token");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// 响应拦截器 - 处理常见错误
api.interceptors.response.use(
    (response) => {
        return response.data;
    },
    (error) => {
        // 处理401错误 - 未授权/token过期
        if (error.response && error.response.status === 401) {
            if (error.config.url.endsWith("/login")) {
                return Promise.reject(error);
            }

            // 清除本地存储的token和用户信息
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            // 重定向到登录页
            window.location.href = "/login";
        }
        return Promise.reject(error);
    }
);

// API服务
const apiService = {
    // 登录
    login: async (username, password) => {
        try {
            const response = await api.post("/login", { username, password });
            return response;
        } catch (error) {
            console.error("登录失败:", error);
            throw error;
        }
    },

    // 获取集群状态
    getClusterStatus: async () => {
        try {
            const response = await api.get("/v1/cluster/status");
            return response;
        } catch (error) {
            console.error("获取集群状态失败:", error);
            throw error;
        }
    },

    // 按条件查询所有作业
    getJobs: async (params) => {
        try {
            const response = await api.get("/v1/jobs", { params });
            return response;
        } catch (error) {
            console.error("获取作业列表失败:", error);
            throw error;
        }
    },

    // 获取作业详情
    getJobDetails: async (jobId) => {
        try {
            const response = await api.get(`/v1/job/${jobId}`);
            return response;
        } catch (error) {
            console.error(`获取作业 ${jobId} 详情失败:`, error);
            throw error;
        }
    },

    // 获取作业连接信息
    getJobConnectInfo: async (jobId) => {
        try {
            const response = await api.get(`/v1/job/connect/${jobId}`);
            return response;
        } catch (error) {
            console.error(`获取作业 ${jobId} 连接信息失败:`, error);
            throw error;
        }
    },

    // 获取作业失败信息
    getJobInfos: async () => {
        try {
            const response = await api.get("/v1/jobs/info");
            return response;
        } catch (error) {
            console.error("获取作业信息失败:", error);
            throw error;
        }
    },

    // 删除作业
    deleteJob: async (jobId) => {
        try {
            const response = await api.delete(`/v1/job/${jobId}`);
            return response;
        } catch (error) {
            console.error(`删除作业 ${jobId} 失败:`, error);
            throw error;
        }
    },

    // 创建 salloc 交互式会话
    createSallocSession: async (payload) => {
        try {
            const response = await api.post("/v1/salloc/interactive", payload);
            return response;
        } catch (error) {
            console.error("创建 salloc 会话失败:", error);
            throw error;
        }
    },

    // 提交 sbatch 作业
    submitSbatchJob: async (scriptContent) => {
        try {
            const response = await api.post("/v1/sbatch", { script: scriptContent });
            return response;
        } catch (error) {
            console.error("提交 sbatch 作业失败:", error);
            throw error;
        }
    },
};

export default apiService;
