import { useState, useEffect } from "react";
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
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import apiService from "../services/api";
import InteractiveTerminal from "../components/InteractiveTerminal";

function DebugJob() {
    const [formData, setFormData] = useState({
        nodename: "",
        partition: "debug",
        task_name: "",
        time: "0-01:00:00",
        gpu_count: 1,
    });
    const [sessions, setSessions] = useState([]);
    const [activeTab, setActiveTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [token, setToken] = useState("");

    // 组件加载时，从 localStorage 恢复会话列表并获取 token
    useEffect(() => {
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
    }, []);

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: name === "gpu_count" ? parseInt(value, 10) || 0 : value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const response = await apiService.createSallocSession(formData);
            const newSession = {
                id: response.session_id,
                name: formData.task_name || `Session-${response.session_id.substring(0, 6)}`,
                status: response.status,
            };

            const updatedSessions = [...sessions, newSession];
            setSessions(updatedSessions);
            localStorage.setItem("interactiveSessions", JSON.stringify(updatedSessions));
            setActiveTab(updatedSessions.length - 1); // 自动切换到新标签
        } catch (err) {
            setError(err.response?.data?.details || "创建会话失败，请检查参数或联系管理员。");
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
                            label="任务名称"
                            value={formData.task_name}
                            onChange={handleFormChange}
                            size="small"
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                        <TextField
                            fullWidth
                            name="partition"
                            label="分区"
                            value={formData.partition}
                            onChange={handleFormChange}
                            size="small"
                            required
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <TextField
                            fullWidth
                            name="nodename"
                            label="节点名称 (可选)"
                            value={formData.nodename}
                            onChange={handleFormChange}
                            size="small"
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                        <TextField
                            fullWidth
                            name="time"
                            label="运行时长"
                            value={formData.time}
                            onChange={handleFormChange}
                            size="small"
                        />
                    </Grid>
                    <Grid item xs={6} sm={4} md={1}>
                        <TextField
                            fullWidth
                            name="gpu_count"
                            label="GPU数"
                            type="number"
                            value={formData.gpu_count}
                            onChange={handleFormChange}
                            size="small"
                        />
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
