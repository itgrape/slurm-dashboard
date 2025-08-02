import { Typography, Box, Paper } from "@mui/material";

function AdminDashboard() {
    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                管理员仪表盘
            </Typography>
            <Paper sx={{ p: 2 }}>
                <Typography>欢迎，管理员！这里是管理员专属的内容区域。</Typography>
            </Paper>
        </Box>
    );
}

export default AdminDashboard;