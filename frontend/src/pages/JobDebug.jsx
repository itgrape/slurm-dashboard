import { useState, useEffect, useMemo } from "react";
import {
    Box,
    Paper,
    Typography,
    Grid,
    TextField,
    Button,
    Tabs,
    Tab,
    Alert,
    CircularProgress,
    IconButton,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import apiService from "../services/api";
import InteractiveTerminal from "../components/InteractiveTerminal";

function DebugJob() {
    const [formData, setFormData] = useState({
        task_name: "",
        task_type: "",
        partition_num: "",
        gpu_count: 0,
        cpu_count: 0,
    });
    const [sessions, setSessions] = useState([]);
    const [activeTab, setActiveTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [token, setToken] = useState("");
    const [partitions, setPartitions] = useState([]);

    useEffect(() => {
        // 组件加载时，从 localStorage 恢复会话列表并获取 token
        const savedSessions = localStorage.getItem("interactiveSessions");
        if (savedSessions) {
            const parsedSessions = JSON.parse(savedSessions);
            if (Array.isArray(parsedSessions)) {
                setSessions(parsedSessions);
            }
        }
        const storedToken = localStorage.getItem("token");
        if (storedToken) {
            setToken(storedToken);
        }

        // 获取所有可用分区
        const fetchPartitions = async () => {
            try {
                const data = await apiService.getAvailablePartitions();
                if (Array.isArray(data)) {
                    setPartitions(data);
                } else {
                    setPartitions([]);
                }
            } catch (error) {
                setError("获取可用分区失败。请检查API端点和网络连接");
                console.error("获取分区时出错:", error);
            }
        };

        fetchPartitions();
    }, []);

    // 动态计算可用分区后缀
    const availablePartitionSuffixes = useMemo(() => {
        if (!formData.task_type) {
            return []; // 如果没选任务类型，则没有可用分区
        }

        let prefix = "";
        if (formData.task_type === "debug") {
            prefix = "debug-";
        } else if (formData.task_type === "run") {
            prefix = formData.gpu_count > 0 ? "gpu-" : "cpu-";
        }

        if (!prefix) {
            return [];
        }

        // 根据前缀过滤并提取后缀
        return partitions
            .filter((p) => p.startsWith(prefix))
            .map((p) => p.substring(prefix.length));
            
    }, [formData.task_type, formData.gpu_count, partitions]);

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        const newFormData = {
            ...formData,
            [name]: name === "gpu_count" || name === "cpu_count" ? parseInt(value, 10) || 0 : value,
        };

        // 当GPU数量不等于0时，把CPU数量设置为0
        if (name === "gpu_count" && value !== "0") {
            newFormData.cpu_count = 0;
        }

        // 当任务类型或GPU数量变化时，它们会影响分区的可用列表，因此需要重置分区的选择
        if (name === "task_type" || name === "gpu_count") {
            newFormData.partition_num = "";
        }

        setFormData(newFormData);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            // 过滤不合法数据
            if (formData.gpu_count > 0 && formData.cpu_count > 0) {
                throw new Error("指定 GPU 数量后，CPU 数量会为自动分配，请勿重复指定");
            }
            if (!(formData.gpu_count > 0 || formData.cpu_count > 0)) {
                throw new Error("不能申请空资源，请指定 GPU 或 CPU 数量");
            }

            // 拼接分区
            let suffix = "debug";
            if (formData.task_type === "run") {
                if (formData.gpu_count > 0) {
                    suffix = "gpu";
                } else {
                    suffix = "cpu";
                }
            }
            let partition = `${suffix}-${formData.partition_num}`;

            // 构造请求数据向后端发送请求
            let payload = {
                task_name: formData.task_name,
                partition: partition,
                gpu_count: formData.gpu_count,
                cpu_count: formData.cpu_count,
            };

            const response = await apiService.createSallocSession(payload);
            const newSession = {
                id: response.session_id,
                name: payload.task_name || `Session-${response.session_id.substring(0, 6)}`,
                status: response.status,
            };

            const updatedSessions = [...sessions, newSession];
            setSessions(updatedSessions);
            localStorage.setItem("interactiveSessions", JSON.stringify(updatedSessions));
            setActiveTab(updatedSessions.length - 1); // 自动切换到新标签
        } catch (err) {
            setError(err.response?.data?.details || err.message || "创建会话失败，请检查参数或联系管理员");
        } finally {
            setLoading(false);
        }
    };

    const handleTabChange = (event, newValue) => {
        setActiveTab(newValue);
    };

    const handleCloseTab = (e, sessionIdToClose) => {
        e.stopPropagation(); // 防止触发 onTabChange

        const updatedSessions = sessions.filter((s) => s.id !== sessionIdToClose);

        const closingTabIndex = sessions.findIndex((s) => s.id === sessionIdToClose);
        // 如果关闭的是当前激活的或之前的标签，需要调整activeTab
        if (activeTab >= closingTabIndex && activeTab > 0) {
            setActiveTab(activeTab - 1);
        } else if (updatedSessions.length === 0) {
            setActiveTab(0);
        }

        setSessions(updatedSessions);
        localStorage.setItem("interactiveSessions", JSON.stringify(updatedSessions));
    };

    return (
        <Box>
            {/* 表单区域 */}
            <Paper component="form" onSubmit={handleSubmit} sx={{ p: 2, mb: 3 }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={6} md={2}>
                        <TextField
                            fullWidth
                            name="task_name"
                            label="任务名称 (可选)"
                            value={formData.task_name}
                            onChange={handleFormChange}
                            size="small"
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                        <FormControl fullWidth size="small" sx={{ minWidth: 140 }} required>
                            <InputLabel id="task-type-label">任务类型</InputLabel>
                            <Select
                                labelId="task-type-label"
                                id="task_type"
                                name="task_type"
                                value={formData.task_type}
                                onChange={handleFormChange}
                                label="任务类型"
                            >
                                <MenuItem value="run">运行</MenuItem>
                                <MenuItem value="debug">调试</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={6} sm={4} md={1}>
                        <TextField
                            fullWidth
                            name="gpu_count"
                            label="GPU 数量 (可选)"
                            type="number"
                            value={formData.gpu_count}
                            onChange={handleFormChange}
                            size="small"
                        />
                    </Grid>
                    <Grid item xs={6} sm={4} md={1}>
                        <TextField
                            fullWidth
                            name="cpu_count"
                            label="CPU 数量 (可选)"
                            type="number"
                            value={formData.cpu_count}
                            onChange={handleFormChange}
                            size="small"
                            disabled={formData.gpu_count > 0}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                        <FormControl fullWidth size="small" required sx={{ minWidth: 170 }}>
                            <InputLabel id="partition-num-label">分区</InputLabel>
                            <Select
                                labelId="partition-num-label"
                                name="partition_num"
                                value={formData.partition_num}
                                onChange={handleFormChange}
                                label="分区"
                                // 当没有选择任务类型以及没有指定CPU和GPU时，禁用此下拉框
                                disabled={!formData.task_type || (formData.gpu_count == 0 && formData.cpu_count == 0)}
                            >
                                {availablePartitionSuffixes.map((suffix) => (
                                    <MenuItem key={suffix} value={suffix}>
                                        {suffix}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={6} sm={2} md={2}>
                        <Button type="submit" variant="contained" disabled={loading} fullWidth>
                            {loading ? <CircularProgress size={24} /> : "创建会话"}
                        </Button>
                    </Grid>
                </Grid>
                {error && (
                    <Alert severity="error" sx={{ mt: 2 }}>
                        {error}
                    </Alert>
                )}
            </Paper>

            {/* 终端和标签页区域 */}
            <Paper sx={{ height: "72vh", display: "flex", flexDirection: "column" }}>
                <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
                    <Tabs value={activeTab} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
                        {sessions.map((session, index) => (
                            <Tab
                                key={session.id}
                                component="div"
                                label={
                                    <Box sx={{ display: "flex", alignItems: "center" }}>
                                        {session.name}
                                        <IconButton
                                            size="small"
                                            onClick={(e) => handleCloseTab(e, session.id)}
                                            sx={{ ml: 2, p: 0.5 }}
                                        >
                                            <CloseIcon fontSize="small" />
                                        </IconButton>
                                    </Box>
                                }
                            />
                        ))}
                    </Tabs>
                </Box>
                <Box sx={{ flexGrow: 1, position: "relative", overflow: "hidden" }}>
                    {sessions.map((session, index) => (
                        <Box
                            key={session.id}
                            role="tabpanel"
                            sx={{
                                display: activeTab === index ? "block" : "none",
                                height: "100%",
                                width: "100%",
                                boxSizing: "border-box",
                            }}
                        >
                            <InteractiveTerminal sessionId={session.id} token={token} isActive={activeTab === index} />
                        </Box>
                    ))}
                    {sessions.length === 0 && (
                        <Box sx={{ p: 3, textAlign: "center" }}>
                            <Typography color="text.secondary">
                                没有活动的会话。请在上方表单中创建一个新的交互式会话。
                            </Typography>
                        </Box>
                    )}
                </Box>
            </Paper>
        </Box>
    );
}

export default DebugJob;
