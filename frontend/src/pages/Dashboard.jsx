import { useState, useEffect } from "react";
import { Typography, Grid, Box, Card, CardContent, Alert, CircularProgress, LinearProgress, Divider } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import DnsIcon from "@mui/icons-material/Dns";
import MemoryIcon from "@mui/icons-material/Memory";
import DeveloperBoardIcon from "@mui/icons-material/DeveloperBoard";
import apiService from "../services/api";

// 设置主页不应显示的节点
const FILTERED_NODES = ["login", "portal", "app"];

// 资源使用率进度条组件
const ResourceProgress = ({ title, used, total, unit = "" }) => {
    const theme = useTheme();
    const percentage = total > 0 ? (used / total) * 100 : 0;
    let progressColor = theme.palette.success.light;
    if (percentage > 85) {
        progressColor = theme.palette.error.main;
    } else if (percentage > 60) {
        progressColor = theme.palette.warning.light;
    }

    return (
        <Box sx={{ width: "100%", my: 1.5 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5, alignItems: "center" }}>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {title}
                </Typography>
                <Typography variant="body2" color="text.secondary">{`${used} / ${total} ${unit}`}</Typography>
            </Box>
            <LinearProgress
                variant="determinate"
                value={percentage}
                sx={{
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: theme.palette.grey[200],
                    "& .MuiLinearProgress-bar": {
                        borderRadius: 5,
                        backgroundColor: progressColor,
                    },
                }}
            />
        </Box>
    );
};

function Dashboard() {
    const [processedData, setProcessedData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchAndProcessData = async () => {
            try {
                const data = await apiService.getClusterStatus();

                // 过滤掉管理节点
                const filteredNodes = data.nodes.filter(
                    (node) => !FILTERED_NODES.some((filterWord) => String(node.name).toLowerCase().includes(filterWord))
                );

                // 按分区聚合数据
                const partitionsMap = {};

                data.partitions.forEach((p) => {
                    partitionsMap[p.name] = {
                        name: p.name,
                        total_cpus: 0,
                        allocated_cpus: 0,
                        gpus: {}, // { 'GPU_TYPE': { total: x, allocated: y } }
                    };
                });

                filteredNodes.forEach((node) => {
                    node.partitions.forEach((partitionName) => {
                        if (partitionsMap[partitionName]) {
                            const partition = partitionsMap[partitionName];
                            partition.total_cpus += node.total_cpus;
                            partition.allocated_cpus += node.allocated_cpus;

                            if (node.gpus && node.gpus.length > 0) {
                                node.gpus.forEach((gpu) => {
                                    if (!partition.gpus[gpu.type]) {
                                        partition.gpus[gpu.type] = { total: 0, allocated: 0 };
                                    }
                                    partition.gpus[gpu.type].total += gpu.total;
                                    partition.gpus[gpu.type].allocated += gpu.allocated;
                                });
                            }
                        }
                    });
                });
                
                const partitionArray = Object.values(partitionsMap);
                partitionArray.sort((a, b) => a.name.localeCompare(b.name));
                setProcessedData(Object.values(partitionArray));
            } catch (err) {
                setError("获取集群状态失败。请检查API端点和网络连接。");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchAndProcessData();
        const intervalId = setInterval(fetchAndProcessData, 30000);
        return () => clearInterval(intervalId);
    }, []);

    if (loading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80vh" }}>
                <CircularProgress />
                <Typography sx={{ ml: 2 }}>加载集群数据中...</Typography>
            </Box>
        );
    }

    if (error) {
        return <Alert severity="error">{error}</Alert>;
    }

    return (
        <Box sx={{ flexGrow: 1, p: 1 }}>
            {/* <Typography variant="h4" sx={{ mb: 3, fontWeight: 500, color: "text.primary" }}>
                分区资源概览
            </Typography> */}

            <Grid container spacing={4}>
                {processedData.map((partition) => (
                    <Grid item xs={12} md={6} lg={4} key={partition.name}>
                        <Card
                            variant="outlined"
                            sx={{
                                height: "100%",
                                borderRadius: 3,
                                boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                                transition: "transform 0.3s, box-shadow 0.3s",
                                "&:hover": {
                                    transform: "translateY(-5px)",
                                    boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
                                },
                            }}
                        >
                            <CardContent sx={{ p: 3 }}>
                                <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                                    <DnsIcon sx={{ color: "primary.main", mr: 1.5 }} />
                                    <Typography variant="h5" component="div" fontWeight="bold" textTransform="uppercase">
                                        {partition.name}
                                    </Typography>
                                </Box>
                                <Divider sx={{ mb: 2 }} />

                                {/* CPU 资源 */}
                                <Box sx={{ mb: 2 }}>
                                    <ResourceProgress
                                        title="CPU 核心&nbsp;&nbsp;"
                                        used={partition.allocated_cpus}
                                        total={partition.total_cpus}
                                        unit="Cores"
                                    />
                                </Box>

                                {/* GPU 资源 */}
                                <Box>
                                    <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                                        <DeveloperBoardIcon sx={{ color: "text.secondary", mr: 1.5 }} />
                                        <Typography variant="h6" sx={{ fontWeight: 500 }}>
                                            GPU 设备
                                        </Typography>
                                    </Box>
                                    {Object.keys(partition.gpus).length > 0 ? (
                                        Object.entries(partition.gpus).map(([type, data]) => (
                                            <ResourceProgress
                                                key={type}
                                                title={type}
                                                used={data.allocated}
                                                total={data.total}
                                            />
                                        ))
                                    ) : (
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                mt: 2,
                                                color: "text.secondary",
                                                textAlign: "center",
                                                fontStyle: "italic",
                                            }}
                                        >
                                            此分区无 GPU 资源
                                        </Typography>
                                    )}
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>
        </Box>
    );
}

export default Dashboard;
