import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
    Box,
    Drawer,
    AppBar,
    Toolbar,
    List,
    Typography,
    Divider,
    IconButton,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Avatar,
    Menu,
    MenuItem,
    Tooltip,
    Collapse,
    Badge,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Button,
} from "@mui/material";
import {
    Menu as MenuIcon,
    ChevronLeft as ChevronLeftIcon,
    Dashboard as DashboardIcon,
    Assessment as AssessmentIcon,
    Settings as SettingsIcon,
    Logout as LogoutIcon,
    Person as PersonIcon,
    Code as CodeIcon,
    School as SchoolIcon,
    Terminal as TerminalIcon,
    ExpandLess as ExpandLessIcon,
    ExpandMore as ExpandMoreIcon,
    CloudUpload as CloudUploadIcon,
    PlayCircleOutline as PlayCircleOutlineIcon,
    BatchPrediction as BatchPredictionIcon,
    Info as InfoIcon,
} from "@mui/icons-material";
import { deepOrange, deepPurple } from '@mui/material/colors';
import { styled } from "@mui/material/styles";
import { Link } from "react-router-dom";
import Terminal from "../components/Terminal";
import apiService from "../services/api";

const drawerWidth = 240;
const iconTextDistance = 40;

const Main = styled("main", { shouldForwardProp: (prop) => prop !== "open" })(({ theme, open }) => ({
    flexGrow: 1,
    padding: theme.spacing(3),
    transition: theme.transitions.create("margin", {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
    }),
    marginLeft: `-${drawerWidth}px`,
    ...(open && {
        transition: theme.transitions.create("margin", {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.enteringScreen,
        }),
        marginLeft: 0,
    }),
}));

const AppBarStyled = styled(AppBar, {
    shouldForwardProp: (prop) => prop !== "open",
})(({ theme, open }) => ({
    transition: theme.transitions.create(["margin", "width"], {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
    }),
    ...(open && {
        width: `calc(100% - ${drawerWidth}px)`,
        marginLeft: `${drawerWidth}px`,
        transition: theme.transitions.create(["margin", "width"], {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.enteringScreen,
        }),
    }),
}));

const DrawerHeader = styled("div")(({ theme }) => ({
    display: "flex",
    alignItems: "center",
    padding: theme.spacing(0, 1),
    // necessary for content to be below app bar
    ...theme.mixins.toolbar,
    justifyContent: "flex-end",
}));

const menuItems = [
    { text: "集群资源", icon: <DashboardIcon />, path: "/" },
    { text: "作业管理", icon: <AssessmentIcon />, path: "/jobs" },
    {
        text: "作业提交",
        icon: <CloudUploadIcon />,
        items: [
            { text: "交互式作业", icon: <PlayCircleOutlineIcon />, path: "/job-debug" },
            { text: "批处理作业", icon: <BatchPredictionIcon />, path: "/job-batch" },
            { text: "脚本生成", icon: <CodeIcon />, path: "/script-generator" },
        ],
    },
    { text: "使用教程", icon: <SchoolIcon />, path: "/tutorial" },
];

function MainLayout() {
    const { user, logout } = useAuth();
    const [open, setOpen] = useState(true);
    const [anchorElUser, setAnchorElUser] = useState(null);
    const [isTerminalOpen, setIsTerminalOpen] = useState(false);
    const [subMenuOpen, setSubMenuOpen] = useState(true);
    const [jobInfos, setJobInfos] = useState({ infos: {}, num: 0 });
    const [openInfoDialog, setOpenInfoDialog] = useState(false);

    useEffect(() => {
        const fetchJobInfos = async () => {
            try {
                const data = await apiService.getJobInfos();
                setJobInfos(data);
            } catch (error) {
                console.error("Failed to fetch job infos:", error);
            }
        };
        fetchJobInfos();
        const intervalId = setInterval(fetchJobInfos, 30000); // fetch every 30 seconds
        return () => clearInterval(intervalId);
    }, []);

    const handleDrawerOpen = () => {
        setOpen(true);
    };

    const handleDrawerClose = () => {
        setOpen(false);
    };

    const handleOpenUserMenu = (event) => {
        setAnchorElUser(event.currentTarget);
    };

    const handleCloseUserMenu = () => {
        setAnchorElUser(null);
    };

    const handleLogout = () => {
        handleCloseUserMenu();
        logout();
    };

    const handleToggleTerminal = () => {
        setIsTerminalOpen(!isTerminalOpen);
    };

    const handleSubMenuClick = () => {
        setSubMenuOpen(!subMenuOpen);
    };

    const handleOpenInfoDialog = () => {
        setOpenInfoDialog(true);
        handleCloseUserMenu();
    };

    const handleCloseInfoDialog = () => {
        setOpenInfoDialog(false);
    };

    return (
        <Box sx={{ display: "flex" }}>
            <AppBarStyled position="fixed" open={open}>
                <Toolbar>
                    <IconButton
                        color="inherit"
                        aria-label="open drawer"
                        onClick={handleDrawerOpen}
                        edge="start"
                        sx={{ mr: 2, ...(open && { display: "none" }) }}
                    >
                        <MenuIcon />
                    </IconButton>
                    <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}></Typography>

                    {/* Terminal Icon */}
                    <Tooltip title="打开终端">
                        <IconButton color="inherit" onClick={handleToggleTerminal}>
                            <TerminalIcon />
                        </IconButton>
                    </Tooltip>

                    {/* 用户菜单 */}
                    <Box sx={{ flexGrow: 0, ml: 2 }}>
                        <Tooltip title="打开设置">
                            <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                                <Badge badgeContent={jobInfos.num} color="error">
                                    <Avatar sx={{ bgcolor: deepPurple[500] }}>
                                        {user?.name?.charAt(0) || user?.username?.charAt(0) || "U"}
                                    </Avatar>
                                </Badge>
                            </IconButton>
                        </Tooltip>
                        <Menu
                            sx={{ mt: "45px" }}
                            id="menu-appbar"
                            anchorEl={anchorElUser}
                            anchorOrigin={{
                                vertical: "top",
                                horizontal: "right",
                            }}
                            keepMounted
                            transformOrigin={{
                                vertical: "top",
                                horizontal: "right",
                            }}
                            open={Boolean(anchorElUser)}
                            onClose={handleCloseUserMenu}
                        >
                            <MenuItem disabled>
                                <Typography textAlign="center">{user?.name || user?.username}</Typography>
                            </MenuItem>
                            <Divider />
                            <MenuItem onClick={handleOpenInfoDialog}>
                                <ListItemIcon>
                                    <InfoIcon fontSize="small" />
                                </ListItemIcon>
                                <Typography textAlign="center">查看信息</Typography>
                            </MenuItem>
                            <MenuItem onClick={handleLogout}>
                                <ListItemIcon>
                                    <LogoutIcon fontSize="small" />
                                </ListItemIcon>
                                <Typography textAlign="center">退出登录</Typography>
                            </MenuItem>
                        </Menu>
                    </Box>
                </Toolbar>
            </AppBarStyled>
            <Drawer
                sx={{
                    width: drawerWidth,
                    flexShrink: 0,
                    "& .MuiDrawer-paper": {
                        width: drawerWidth,
                        boxSizing: "border-box",
                    },
                }}
                variant="persistent"
                anchor="left"
                open={open}
            >
                <DrawerHeader>
                    <Typography variant="h6" sx={{ flexGrow: 1, ml: 2 }}>
                        Slurm 仪表盘
                    </Typography>
                    <IconButton onClick={handleDrawerClose}>
                        <ChevronLeftIcon />
                    </IconButton>
                </DrawerHeader>
                <Divider />
                <List>
                    {menuItems.map((item, index) =>
                        item.items ? (
                            <div key={item.text}>
                                <ListItemButton onClick={handleSubMenuClick}>
                                    <ListItemIcon sx={{ minWidth: iconTextDistance }}>{item.icon}</ListItemIcon>
                                    <ListItemText primary={item.text} />
                                    {subMenuOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                </ListItemButton>
                                <Collapse in={subMenuOpen} timeout="auto" unmountOnExit>
                                    <List component="div" disablePadding>
                                        {item.items.map((subItem) => (
                                            <ListItem
                                                key={subItem.text}
                                                disablePadding
                                                component={Link}
                                                to={subItem.path}
                                                sx={{ color: "inherit", textDecoration: "none", pl: 4 }}
                                            >
                                                <ListItemButton>
                                                    <ListItemIcon sx={{ minWidth: iconTextDistance }}>
                                                        {subItem.icon}
                                                    </ListItemIcon>
                                                    <ListItemText primary={subItem.text} />
                                                </ListItemButton>
                                            </ListItem>
                                        ))}
                                    </List>
                                </Collapse>
                            </div>
                        ) : (
                            <ListItem
                                key={item.text}
                                disablePadding
                                component={Link}
                                to={item.path}
                                sx={{ color: "inherit", textDecoration: "none" }}
                            >
                                <ListItemButton>
                                    <ListItemIcon sx={{ minWidth: iconTextDistance }}>{item.icon}</ListItemIcon>
                                    <ListItemText primary={item.text} />
                                </ListItemButton>
                            </ListItem>
                        )
                    )}
                </List>
            </Drawer>
            <Main open={open}>
                <DrawerHeader />
                <Outlet />
            </Main>
            <Drawer
                anchor="bottom"
                open={isTerminalOpen}
                onClose={() => setIsTerminalOpen(false)}
                ModalProps={{
                    keepMounted: true, // 确保抽屉关闭时其内容不被卸载
                }}
                PaperProps={{
                    sx: {
                        height: "69vh",
                        width: "100%",
                        overflow: "hidden",
                    },
                }}
            >
                <Terminal isOpen={isTerminalOpen} />
            </Drawer>

            {/* Info Dialog */}
            <Dialog open={openInfoDialog} onClose={handleCloseInfoDialog} scroll="paper" fullWidth maxWidth="md">
                <DialogTitle>作业信息</DialogTitle>
                <DialogContent dividers>
                    <DialogContentText
                        component="div" // Use div to allow for preformatted text
                        sx={{
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-all",
                            fontFamily: "monospace",
                            fontSize: "0.875rem",
                        }}
                    >
                        {Object.entries(jobInfos.infos).map(([jobId, info]) => (
                            <Box key={jobId} sx={{ mb: 2 }}>
                                <Typography variant="h6" component="div">
                                    Job ID: {jobId}
                                </Typography>
                                {info}
                            </Box>
                        ))}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseInfoDialog}>关闭</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default MainLayout;
