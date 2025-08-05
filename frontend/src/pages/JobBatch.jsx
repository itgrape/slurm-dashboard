import { useState, useEffect, useMemo } from "react";
import {
    Box,
    Typography,
    Paper,
    Grid,
    TextField,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Snackbar,
    Alert,
    Divider,
    Chip,
    OutlinedInput,
    Checkbox,
    ListItemText,
    CircularProgress,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import apiService from "../services/api";

// 邮件通知类型选项
const mailTypes = ["BEGIN", "END", "FAIL"];

// 初始表单状态
const initialFormState = {
    // 任务
    jobName: "",
    task_type: "",
    partition_num: "",
    runTime: "",
    // 资源
    gpuTotal: "",
    cpuTotal: "",
    tasksPerNode: 1,
    // 日志
    outputFile: "",
    errorFile: "",
    workDir: "",
    // 邮件
    mailType: [],
    mailUser: "",
    // 脚本
    taskScript: "",
};

function BatchJob() {
    const [formData, setFormData] = useState(initialFormState);
    const [generatedScript, setGeneratedScript] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [partitions, setPartitions] = useState([]);
    const [submitStatus, setSubmitStatus] = useState({
        open: false,
        severity: "success",
        message: "",
    });

    useEffect(() => {
        const fetchPartitions = async () => {
            try {
                const data = await apiService.getAvailablePartitions();
                if (Array.isArray(data)) {
                    setPartitions(data);
                } else {
                    setPartitions([]);
                }
            } catch (error) {
                console.error("获取分区时出错:", error);
            }
        };
        fetchPartitions();
    }, []);

    const availablePartitionSuffixes = useMemo(() => {
        if (!formData.task_type) {
            return []; // 如果没选任务类型，则没有可用分区
        }

        let prefix = "";
        if (formData.task_type === "debug") {
            prefix = "debug-";
        } else if (formData.task_type === "run") {
            // 注意：这里需要将 formData.gpuTotal 转换为数字
            const gpuCount = parseInt(formData.gpuTotal, 10) || 0;
            prefix = gpuCount > 0 ? "gpu-" : "cpu-";
        }

        if (!prefix) {
            return [];
        }

        return partitions.filter((p) => p.startsWith(prefix)).map((p) => p.substring(prefix.length));
    }, [formData.task_type, formData.gpuTotal, partitions]);

    const handleFormChange = (event) => {
        const { name, value } = event.target;
        const newFormData = { ...formData, [name]: value };

        // 当任务类型或GPU数量变化时，重置分区选择
        if (name === "task_type" || name === "gpuTotal") {
            newFormData.partition_num = "";
        }
        setFormData(newFormData);
    };

    // 根据表单数据生成脚本
    useEffect(() => {
        const {
            jobName,
            task_type,
            partition_num,
            runTime,
            gpuTotal,
            cpuTotal,
            tasksPerNode,
            outputFile,
            errorFile,
            workDir,
            mailType,
            mailUser,
            taskScript,
        } = formData;

        // 拼接分区信息
        let final_partition = "";
        if (task_type && partition_num && partition_num.trim() !== "") {
            let suffix = "";
            if (task_type === "debug") {
                suffix = "debug";
            } else if (task_type === "run") {
                if ((parseInt(gpuTotal, 10) || 0) > 0) {
                    suffix = "gpu";
                } else {
                    suffix = "cpu";
                }
            }
            if (suffix) {
                final_partition = `${suffix}-${partition_num}`;
            }
        }

        let script = `#!/bin/bash
#SBATCH --job-name=${jobName || "my-job"}`;
        if (final_partition) script += `\n#SBATCH --partition=${final_partition}`;
        if (runTime) script += `\n#SBATCH --time=${runTime}`;
        if (tasksPerNode) script += `\n#SBATCH --ntasks-per-node=${tasksPerNode}`;
        if (gpuTotal) script += `\n#SBATCH --gpus=${gpuTotal}`;
        if (cpuTotal) script += `\n#SBATCH --cpus-per-task=${Math.floor(cpuTotal / tasksPerNode)}`;
        if (outputFile) script += `\n#SBATCH --output=${outputFile}`;
        if (errorFile) script += `\n#SBATCH --error=${errorFile}`;
        if (workDir) script += `\n#SBATCH --chdir=${workDir}`;
        if (mailType.length > 0) script += `\n#SBATCH --mail-type=${mailType.join(",")}`;
        if (mailUser) script += `\n#SBATCH --mail-user=${mailUser}`;

        script += `\n\n# --- 打印节点信息 ---
echo "SLURM_JOB_NODELIST: $SLURM_JOB_NODELIST"
nodes=( $( scontrol show hostnames $SLURM_JOB_NODELIST ) )
nodes_array=($nodes)
head_node=\${nodes_array[0]}
head_node_ip=$(srun --nodes=1 --ntasks=1 -w "$head_node" hostname --ip-address)
echo "Node IP: $head_node_ip"
export LOGLEVEL=INFO

# --- 以下是任务脚本 ---
srun --nodes=\${#nodes_array[@]} --ntasks-per-node=${tasksPerNode} ${taskScript || "torchrun your_script.py"}`;

        setGeneratedScript(script);
    }, [formData]);

    const handleSubmitScript = async () => {
        setIsSubmitting(true);
        try {
            // 简单的表单数据过滤
            const { gpuTotal, cpuTotal } = formData;
            const gpuCount = parseInt(gpuTotal, 10) || 0;
            const cpuCount = parseInt(cpuTotal, 10) || 0;
            if (gpuCount > 0 && cpuCount > 0) {
                throw new Error("指定 GPU 数量后，CPU 数量会为自动分配，请勿重复指定");
            }
            if (!(gpuCount > 0 || cpuCount > 0)) {
                throw new Error("不能申请空资源，请指定 GPU 或 CPU 数量");
            }

            const response = await apiService.submitSbatchJob(generatedScript);
            setSubmitStatus({
                open: true,
                severity: "success",
                message: `作业提交成功！Job ID: ${response.job_id}`,
            });
        } catch (error) {
            setSubmitStatus({
                open: true,
                severity: "error",
                message: `提交失败: ${error.response?.data?.error || error.message}`,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCloseSnackbar = (event, reason) => {
        if (reason === "clickaway") {
            return;
        }
        setSubmitStatus({ ...submitStatus, open: false });
    };

    const renderSbatchForm = () => (
        <Box>
            {/* 分组一：资源配置 */}
            <Typography variant="h6" gutterBottom>
                资源配置
            </Typography>
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            label="每个节点任务数 (可选)"
                            name="tasksPerNode"
                            type="number"
                            value={formData.tasksPerNode}
                            onChange={handleFormChange}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <Divider />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            label="GPU 总数量 (可选)"
                            name="gpuTotal"
                            type="number"
                            value={formData.gpuTotal}
                            onChange={handleFormChange}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            label="CPU 总数量 (可选)"
                            name="cpuTotal"
                            type="number"
                            value={formData.cpuTotal}
                            onChange={handleFormChange}
                            disabled={formData.gpuTotal > 0}
                        />
                    </Grid>
                </Grid>
            </Paper>

            {/* 分组二：任务配置 */}
            <Typography variant="h6" gutterBottom>
                任务配置
            </Typography>
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            required
                            label="任务名称"
                            name="jobName"
                            value={formData.jobName}
                            onChange={handleFormChange}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                        <FormControl fullWidth sx={{ minWidth: 180 }} required>
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
                    <Grid item xs={12} sm={6}>
                        <FormControl fullWidth required sx={{ minWidth: 180 }}>
                            <InputLabel id="partition-num-label">分区</InputLabel>
                            <Select
                                labelId="partition-num-label"
                                name="partition_num"
                                value={formData.partition_num}
                                onChange={handleFormChange}
                                label="分区"
                                disabled={!formData.task_type || (formData.gpuTotal == 0 && formData.cpuTotal == 0)}
                            >
                                {availablePartitionSuffixes.map((suffix) => (
                                    <MenuItem key={suffix} value={suffix}>
                                        {suffix}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            label="最长运行时间 (可选)"
                            name="runTime"
                            value={formData.runTime}
                            onChange={handleFormChange}
                            helperText="格式: D-HH:MM:SS"
                        />
                    </Grid>
                </Grid>
            </Paper>

            {/* 分组三：日志与工作目录 */}
            <Typography variant="h6" gutterBottom>
                日志与工作目录
            </Typography>
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            label="输出文件 (可选)"
                            name="outputFile"
                            value={formData.outputFile}
                            onChange={handleFormChange}
                            helperText="例如 /path/to/output.log"
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            label="错误文件 (可选)"
                            name="errorFile"
                            value={formData.errorFile}
                            onChange={handleFormChange}
                            helperText="例如 /path/to/error.log"
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <TextField
                            fullWidth
                            label="工作目录 (可选)"
                            name="workDir"
                            value={formData.workDir}
                            onChange={handleFormChange}
                            helperText="脚本执行的起始路径"
                        />
                    </Grid>
                </Grid>
            </Paper>

            {/* 分组四：邮件通知 */}
            <Typography variant="h6" gutterBottom>
                邮件通知 (可选)
            </Typography>
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                            <InputLabel>邮件通知类型</InputLabel>
                            <Select
                                multiple
                                name="mailType"
                                value={formData.mailType}
                                onChange={handleFormChange}
                                input={<OutlinedInput label="邮件通知类型" />}
                                renderValue={(selected) => (
                                    <Box
                                        sx={{
                                            display: "flex",
                                            flexWrap: "wrap",
                                            gap: 0.5,
                                            height: "20px",
                                        }}
                                    >
                                        {selected.map((value) => (
                                            <Chip key={value} label={value} />
                                        ))}
                                    </Box>
                                )}
                                sx={{ minWidth: "200px" }}
                            >
                                {mailTypes.map((type) => (
                                    <MenuItem key={type} value={type}>
                                        <Checkbox checked={formData.mailType.indexOf(type) > -1} />
                                        <ListItemText primary={type} />
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            sx={{ minWidth: "320px" }}
                            label="接收通知的邮箱地址"
                            name="mailUser"
                            value={formData.mailUser}
                            onChange={handleFormChange}
                        />
                    </Grid>
                </Grid>
            </Paper>

            {/* 任务脚本 */}
            <Typography variant="h6" gutterBottom>
                任务脚本
            </Typography>
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                <TextField
                    fullWidth
                    required
                    multiline
                    rows={6}
                    label="任务脚本内容"
                    name="taskScript"
                    value={formData.taskScript}
                    onChange={handleFormChange}
                    placeholder="torchrun your_script.py"
                    defaultValue="torchrun your_script.py"
                />
            </Paper>
        </Box>
    );

    return (
        <Box>
            <Paper sx={{ p: 3, mb: 3 }}>{renderSbatchForm()}</Paper>

            <Typography variant="h5" gutterBottom>
                脚本预览
            </Typography>
            <Paper variant="outlined" sx={{ p: 2, background: "#f5f5f5", position: "relative" }}>
                <Button
                    variant="contained"
                    size="small"
                    onClick={handleSubmitScript}
                    disabled={isSubmitting}
                    startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                    sx={{ position: "absolute", top: 8, right: 8 }}
                >
                    提交
                </Button>
                <Box
                    component="pre"
                    sx={{
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                        m: 0,
                    }}
                >
                    <code>{generatedScript}</code>
                </Box>
            </Paper>

            <Snackbar open={submitStatus.open} autoHideDuration={6000} onClose={handleCloseSnackbar}>
                <Alert onClose={handleCloseSnackbar} severity={submitStatus.severity} sx={{ width: "100%" }}>
                    {submitStatus.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}

export default BatchJob;
