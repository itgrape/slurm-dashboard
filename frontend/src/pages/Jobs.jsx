import { useState, useEffect, useCallback } from "react";
import {
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    Chip,
    Box,
    TextField,
    Button,
    Grid,
    CircularProgress,
    Alert,
    IconButton,
    Tooltip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";
import { useAuth } from "../contexts/AuthContext";
import apiService from "../services/api";

// 作业状态及其对应的颜色
const jobStateColors = {
    RUNNING: "primary",
    PENDING: "warning",
    COMPLETED: "success",
    FAILED: "error",
    CANCELLED: "default",
    TIMEOUT: "secondary",
};

// 获取状态颜色，提供默认值
const getStatusColor = (status) => {
    const state = Array.isArray(status) ? status[0] : status;
    return jobStateColors[state] || "default";
};

// 格式化时间戳
const formatTimestamp = (ts) => {
    if (!ts || !ts.set || ts.infinite) return "N/A";
    return new Date(ts.number * 1000).toLocaleString();
};

function Jobs() {
    const { user } = useAuth();
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [filters, setFilters] = useState({ username: "", state: "" });
    const [activeFilters, setActiveFilters] = useState({
        username: "",
        state: "",
    });

    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const [deleteCandidate, setDeleteCandidate] = useState(null);
    const [selectedJob, setSelectedJob] = useState(null);
    const [connectInfo, setConnectInfo] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // 获取作业列表
    const fetchJobs = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = {};
            if (activeFilters.username) params.username = activeFilters.username;
            if (activeFilters.state) params.state = activeFilters.state;

            const data = await apiService.getJobs(params);
            setJobs(data.jobs || []);
        } catch (err) {
            setError("无法加载作业列表，请稍后重试。");
        } finally {
            setLoading(false);
        }
    }, [activeFilters]);

    useEffect(() => {
        fetchJobs();
    }, [fetchJobs]);

    const handleFilterChange = (event) => {
        const { name, value } = event.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    const handleApplyFilters = () => {
        setPage(0);
        setActiveFilters(filters);
    };

    const handleDeleteClick = (jobId) => {
        setDeleteCandidate(jobId);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteCandidate) return;
        try {
            await apiService.deleteJob(deleteCandidate);
            // 刷新列表
            fetchJobs();
        } catch (err) {
            setError(`取消作业 ${deleteCandidate} 失败。`);
        } finally {
            setDeleteCandidate(null);
        }
    };

    // 处理行点击事件，打开详情弹窗
    const handleRowClick = async (job, event) => {
        // 避免在点击删除按钮时触发
        if (event.target.closest("button")) return;

        setSelectedJob(job);
        setDetailLoading(true);
        setConnectInfo(null); // 清空旧的连接信息
        setError(null); // 清空旧的错误

        try {
            const connectionResponse = await apiService.getJobConnectInfo(job.job_id);
            if (connectionResponse && connectionResponse.content) {
                setConnectInfo(connectionResponse.content);
            }
        } catch (err) {
            setError("无法加载作业连接信息。");
            console.error(err);
        } finally {
            setDetailLoading(false);
        }
    };

    // 关闭详情弹窗
    const handleCloseDetailView = () => {
        setSelectedJob(null);
        setConnectInfo(null);
    };

    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                作业管理
            </Typography>

            {/* 筛选表单 */}
            <Paper sx={{ p: 2, mb: 3 }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={5}>
                        <TextField
                            fullWidth
                            label="用户名"
                            name="username"
                            variant="outlined"
                            size="small"
                            value={filters.username}
                            onChange={handleFilterChange}
                        />
                    </Grid>
                    <Grid item xs={12} sm={5}>
                        <FormControl fullWidth size="small" sx={{ minWidth: 150 }}>
                            <InputLabel>状态</InputLabel>
                            <Select name="state" value={filters.state} label="状态" onChange={handleFilterChange}>
                                <MenuItem value="">
                                    <em>全部</em>
                                </MenuItem>
                                {Object.keys(jobStateColors).map((state) => (
                                    <MenuItem key={state} value={state}>
                                        {state}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={2}>
                        <Button fullWidth variant="contained" startIcon={<SearchIcon />} onClick={handleApplyFilters}>
                            筛选
                        </Button>
                    </Grid>
                </Grid>
            </Paper>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            {/* 作业列表 */}
            <Paper sx={{ width: "100%", overflow: "hidden" }}>
                <TableContainer>
                    {loading ? (
                        <Box sx={{ display: "flex", justifyContent: "center", p: 5 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <Table stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell align="center">作业ID</TableCell>
                                    <TableCell align="center">名称</TableCell>
                                    <TableCell align="center">用户</TableCell>
                                    <TableCell align="center">状态</TableCell>
                                    <TableCell align="center">分区</TableCell>
                                    <TableCell align="center">提交时间</TableCell>
                                    <TableCell align="center">开始时间</TableCell>
                                    <TableCell align="center">操作</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {jobs.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((job) => (
                                    <TableRow
                                        hover
                                        key={job.job_id}
                                        onClick={(event) => handleRowClick(job, event)}
                                        sx={{ cursor: "pointer" }}
                                    >
                                        <TableCell align="center">{job.job_id}</TableCell>
                                        <TableCell align="center">{job.name}</TableCell>
                                        <TableCell align="center">{job.user_name}</TableCell>
                                        <TableCell align="center">
                                            <Chip
                                                label={job.job_state.join(", ")}
                                                color={getStatusColor(job.job_state)}
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell align="center">{job.partition}</TableCell>
                                        <TableCell align="center">{formatTimestamp(job.submit_time)}</TableCell>
                                        <TableCell align="center">{formatTimestamp(job.start_time)}</TableCell>
                                        <TableCell align="center">
                                            {user?.username === job.user_name && (
                                                <Tooltip title="取消作业">
                                                    <IconButton
                                                        color="error"
                                                        size="small"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteClick(job.job_id);
                                                        }}
                                                    >
                                                        <DeleteIcon />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </TableContainer>
                <TablePagination
                    rowsPerPageOptions={[10, 25, 50]}
                    component="div"
                    count={jobs.length}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={(e, newPage) => setPage(newPage)}
                    onRowsPerPageChange={(e) => {
                        setRowsPerPage(parseInt(e.target.value, 10));
                        setPage(0);
                    }}
                />
            </Paper>

            {/* 取消确认对话框 */}
            <Dialog open={!!deleteCandidate} onClose={() => setDeleteCandidate(null)}>
                <DialogTitle>确认取消作业？</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        您确定要取消作业ID为 <strong>{deleteCandidate}</strong> 的任务吗？此操作不可恢复。
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteCandidate(null)}>取消</Button>
                    <Button onClick={handleDeleteConfirm} color="error" autoFocus>
                        确认取消
                    </Button>
                </DialogActions>
            </Dialog>

            {/* 作业详情弹窗 */}
            <Dialog open={!!selectedJob} onClose={handleCloseDetailView} maxWidth="md" fullWidth>
                <DialogTitle>作业详情 (ID: {selectedJob?.job_id})</DialogTitle>
                <DialogContent>
                    {selectedJob && (
                        <Grid container spacing={3}>
                            <Grid item xs={12}>
                                <Typography variant="h6" gutterBottom>
                                    资源详情
                                </Typography>
                                <Paper variant="outlined" sx={{ p: 2, background: "#f5f5f5" }}>
                                    <Typography variant="body1" sx={{ mb: 1 }}>
                                        <strong>通用资源:</strong>
                                    </Typography>
                                    <Typography
                                        component="pre"
                                        sx={{
                                            whiteSpace: "pre-wrap",
                                            wordBreak: "break-all",
                                            background: "#e0e0e0",
                                            p: 1,
                                            borderRadius: 1,
                                            mb: 2,
                                        }}
                                    >
                                        {selectedJob.tres_req_str}
                                    </Typography>
                                    <Typography variant="body1" sx={{ mb: 1 }}>
                                        <strong>GPU 信息:</strong>
                                    </Typography>
                                    <Box
                                        sx={{
                                            background: "#e0e0e0",
                                            p: 1,
                                            borderRadius: 1,
                                        }}
                                    >
                                        {selectedJob.gres_detail?.length > 0 ? (
                                            selectedJob.gres_detail.map((detail, index) => (
                                                <Typography key={index} component="div">
                                                    {detail}
                                                </Typography>
                                            ))
                                        ) : (
                                            <Typography>无</Typography>
                                        )}
                                    </Box>
                                </Paper>
                            </Grid>
                            <Grid item xs={12}>
                                <Typography variant="h6" gutterBottom>
                                    连接方式
                                </Typography>
                                <Paper variant="outlined" sx={{ p: 2, background: "#2d2d2d", color: "#f5f5f5" }}>
                                    {detailLoading ? (
                                        <Box sx={{ display: "flex", justifyContent: "center" }}>
                                            <CircularProgress color="inherit" size={24} />
                                            <Typography sx={{ ml: 2 }}>正在加载连接信息...</Typography>
                                        </Box>
                                    ) : (
                                        <Typography
                                            component="pre"
                                            sx={{
                                                whiteSpace: "pre-wrap",
                                                wordBreak: "break-all",
                                                fontFamily: "monospace",
                                            }}
                                        >
                                            {connectInfo || "无可用连接信息。"}
                                        </Typography>
                                    )}
                                </Paper>
                            </Grid>
                        </Grid>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDetailView}>关闭</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default Jobs;
