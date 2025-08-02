import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { CircularProgress, Box } from "@mui/material";

function AdminProtectedRoute() {
    const { user, isAuthenticated, loading } = useAuth();

    if (loading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!isAuthenticated() || user?.role !== "admin") {
        // 如果用户未登录，或不是管理员，重定向到登录页或普通用户首页
        return <Navigate to="/login" />;
    }

    // 如果用户是管理员，渲染子路由
    return <Outlet />;
}

export default AdminProtectedRoute;
