import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { CircularProgress, Box } from "@mui/material";

// 导入布局和页面组件
import MainLayout from "../layouts/MainLayout";
import AdminLayout from "../layouts/AdminLayout";
import Dashboard from "../pages/Dashboard";
import Jobs from "../pages/Jobs";
import Login from "../pages/Login";
import ProtectedRoute from "./ProtectedRoute";
import AdminProtectedRoute from "./AdminProtectedRoute";
import Tutorial from "../pages/Tutorial";
import BatchJob from "../pages/JobBatch";
import DebugJob from "../pages/JobDebug";
import AdminDashboard from "../pages/AdminDashboard";

/**
 * @description 根据用户角色重定向到相应的主页。
 * 这是为了在用户登录后或直接访问根路径时，能够将他们引导到正确的界面。
 */
const HomeRedirect = () => {
    const { user, loading } = useAuth();

    // 在加载用户信息时，显示等待指示器
    if (loading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
                <CircularProgress />
            </Box>
        );
    }

    // 如果用户角色是 'admin'，重定向到管理员仪表盘
    if (user?.role === "admin") {
        return <Navigate to="/admin" replace />;
    }

    // 其他所有已认证用户，重定向到普通用户仪表盘
    return <Navigate to="/dashboard" replace />;
};

export default function AppRoutes() {
    return (
        <Routes>
            {/* 公开路由：登录页面 */}
            <Route path="/login" element={<Login />} />

            {/* 管理员专属路由 */}
            <Route element={<AdminProtectedRoute />}>
                <Route path="/admin" element={<AdminLayout />}>
                    <Route index element={<AdminDashboard />} />
                    {/* 在这里可以添加更多管理员页面, 例如 /admin/users */}
                </Route>
            </Route>

            {/* 普通用户和管理员均可访问的受保护路由 */}
            <Route element={<ProtectedRoute />}>
                {/* 根路径 "/" 会根据用户角色进行重定向 */}
                <Route path="/" element={<HomeRedirect />} />

                {/* 普通用户界面布局 */}
                <Route path="/" element={<MainLayout />}>
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="jobs" element={<Jobs />} />
                    <Route path="job-debug" element={<DebugJob />} />
                    <Route path="job-batch" element={<BatchJob />} />
                    <Route path="tutorial" element={<Tutorial />} />
                </Route>
            </Route>

            {/* 对于所有未匹配的路由，重定向到登录页 */}
            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    );
}
