import { Box, Typography, Paper, Divider, List, ListItem, ListItemIcon, ListItemText, Chip } from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import ListAltIcon from "@mui/icons-material/ListAlt";
import CodeIcon from "@mui/icons-material/Code";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import DeleteIcon from "@mui/icons-material/Delete";
import MouseIcon from "@mui/icons-material/Mouse";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import InfoIcon from "@mui/icons-material/Info";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import BatchPredictionIcon from "@mui/icons-material/BatchPrediction";
import LinkIcon from "@mui/icons-material/Link";

function Tutorial() {
    return (
        <Box>
            {/* <Typography variant="h4" gutterBottom>
                Slurm 仪表盘使用教程
            </Typography> */}

            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography paragraph>
                    本系统旨在为您提供一个直观、易用的界面来监控集群状态、提交和管理您的计算任务，并获取重要的作业通知。本教程将引导您了解系统的主要功能和使用方法。
                </Typography>
            </Paper>

            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h5" gutterBottom sx={{ display: "flex", alignItems: "center" }}>
                    <DashboardIcon sx={{ mr: 1 }} />
                    集群资源概览
                </Typography>
                <Divider sx={{ my: 2 }} />
                <Typography paragraph>登录后您看到的第一个页面就是“集群资源”，它为您提供了集群的实时状态快照。</Typography>
                <List>
                    <ListItem>
                        <ListItemText
                            primary="分区信息"
                            secondary="这里以卡片形式展示了集群中所有可用的计算分区（如 cpu, gpu）以及每个分区包含的节点列表。"
                        />
                    </ListItem>
                    <ListItem>
                        <ListItemText
                            primary="节点状态"
                            secondary="下方则详细列出了每个计算节点的状态卡片。您可以看到节点名称、当前状态（如 IDLE 空闲, ALLOCATED 已分配, MIXED 混合）、CPU和GPU的资源使用率等核心信息。"
                        />
                    </ListItem>
                </List>
            </Paper>

            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h5" gutterBottom sx={{ display: "flex", alignItems: "center" }}>
                    <ListAltIcon sx={{ mr: 1 }} />
                    作业管理
                </Typography>
                <Divider sx={{ my: 2 }} />
                <Typography paragraph>“作业管理”页面是您与自己提交的任务进行交互的核心区域。</Typography>
                <List>
                    <ListItem>
                        <ListItemIcon>
                            <FilterAltIcon />
                        </ListItemIcon>
                        <ListItemText
                            primary="筛选作业"
                            secondary="页面顶部提供了一个筛选表单，您可以按“用户名”或“作业状态”（如 RUNNING, COMPLETED, FAILED）快速找到您关心的任务。"
                        />
                    </ListItem>
                    <ListItem>
                        <ListItemIcon>
                            <MouseIcon />
                        </ListItemIcon>
                        <ListItemText
                            primary="查看资源详情以及连接信息"
                            secondary="直接点击表格中的任意一行，系统会弹出一个窗口，详细展示该任务请求和实际分配到的计算资源（TRES 和 GRES 详情）以及连接所需要的脚本。"
                        />
                    </ListItem>
                    <ListItem>
                        <ListItemIcon>
                            <LinkIcon />
                        </ListItemIcon>
                        <ListItemText
                            primary="连接到作业"
                            secondary="点击某项具体的作业后，将“连接信息”中的内容复制到您的 ~/.ssh/config 目录下，然后就可以像连接以前的服务器那样连接您申请到的计算节点。如果是第一次使用本系统，您还需要执行 ssh-keygen -t rsa -b 4096 后按三下回车，然后执行 ssh-copy-id <username>@<login_node_id>。"
                        />
                    </ListItem>
                    <ListItem>
                        <ListItemIcon>
                            <DeleteIcon color="error" />
                        </ListItemIcon>
                        <ListItemText
                            primary="取消作业"
                            secondary="在您自己提交的作业（用户名与您当前登录用户匹配）最右侧，会有一个红色的删除图标。点击它并确认后，即可向 Slurm 系统请求取消该作业。"
                        />
                    </ListItem>
                </List>
            </Paper>

            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h5" gutterBottom sx={{ display: "flex", alignItems: "center" }}>
                    <CloudUploadIcon sx={{ mr: 1 }} />
                    作业提交
                </Typography>
                <Divider sx={{ my: 2 }} />
                <Typography paragraph>
                    系统提供了多种方式来帮助您快速、准确地提交计算任务，这些功能都集中在侧边栏的“作业提交”菜单下。
                </Typography>
                <List>
                    <ListItem>
                        <ListItemIcon>
                            <PlayCircleOutlineIcon />
                        </ListItemIcon>
                        <ListItemText
                            primary="交互式作业"
                            secondary={
                                <>
                                    用于需要实时交互和调试的场景。您可以在此页面填写任务名称、分区、所需资源等参数来快速创建一个交互式会话。
                                    <br />
                                    创建成功后，页面下方会生成一个对应的终端标签页，您可以直接在网页上进行操作，就像在本地终端一样。
                                </>
                            }
                        />
                    </ListItem>
                    <ListItem>
                        <ListItemIcon>
                            <BatchPredictionIcon />
                        </ListItemIcon>
                        <ListItemText
                            primary="批处理作业"
                            secondary={
                                <>
                                    用于提交需要后台长时间运行的非交互式任务（如模型训练）。此页面提供了一个完整的表单，覆盖了任务配置、资源配置、日志、邮件通知等所有常用 sbatch
                                    选项。
                                    <br />
                                    填写表单时，右侧会实时生成相应的 sbatch
                                    脚本预览。确认无误后，直接点击“提交”按钮即可将任务提交到 Slurm 系统中。
                                </>
                            }
                        />
                    </ListItem>
                    <ListItem>
                        <ListItemIcon>
                            <CodeIcon />
                        </ListItemIcon>
                        <ListItemText
                            primary="脚本生成"
                            secondary="如果您想在自己的本地终端中提交任务，可以使用“脚本生成”功能。它提供了与“批处理作业”类似的表单，但最终目的是生成可复制的 salloc（调试任务）或 sbatch（训练任务）脚本。点击“复制”按钮后，即可将生成的命令或脚本内容粘贴到您的终端或文件中使用。"
                        />
                    </ListItem>
                </List>
            </Paper>

            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h5" gutterBottom sx={{ display: "flex", alignItems: "center" }}>
                    <InfoIcon sx={{ mr: 1 }} />
                    消息通知
                </Typography>
                <Divider sx={{ my: 2 }} />
                <Typography paragraph>
                    为了让您及时了解作业的重要状态变更（例如因资源使用率不足而被系统终止），系统引入了消息通知功能。
                </Typography>
                <List>
                    <ListItem>
                        <ListItemText
                            primary="消息标记"
                            secondary="当有未读的重要信息时，页面右上角您的用户头像上会出现一个红色数字标记，提示您有新的通知。"
                        />
                    </ListItem>
                    <ListItem>
                        <ListItemText
                            primary="查看信息"
                            secondary="点击用户头像，在弹出的菜单中选择“查看信息”选项，即可打开一个对话框，其中会列出所有关于您作业的系统通知详情。"
                        />
                    </ListItem>
                </List>
            </Paper>

            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h5" gutterBottom sx={{ display: "flex", alignItems: "center" }}>
                    <HelpOutlineIcon sx={{ mr: 1 }} />
                    获取帮助
                </Typography>
                <Divider sx={{ my: 2 }} />
                <Typography paragraph>如果您在使用过程中遇到任何问题或有功能建议，请联系系统管理员。</Typography>
            </Paper>
        </Box>
    );
}

export default Tutorial;
