import { createContext, useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import apiService from "../services/api";
import { saveToken, isTokenExpired, clearToken } from "../utils/tokenUtils";

// 创建认证上下文
const AuthContext = createContext(null);

// 注意：移除了模拟用户数据，改为使用真实API

// 认证提供者组件
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // 初始化时检查本地存储中是否有token和用户信息
    useEffect(() => {
        const storedUser = localStorage.getItem("user");

        if (!isTokenExpired()) {
            if (storedUser) {
                try {
                    const parsedUser = JSON.parse(storedUser);
                    setUser(parsedUser);
                } catch (error) {
                    console.error("Error parsing stored user:", error);
                    clearToken();
                }
            }
        } else {
            clearToken();
        }

        setLoading(false);
    }, []);

    // 登录函数
    const login = async (username, password) => {
        try {
            // 调用API登录服务
            const response = await apiService.login(username, password);
            const { token, user: userInfoResponse } = response;

            if (token) {
                saveToken(token);

                // 创建用户信息对象
                const userInfo = {
                    username: userInfoResponse.username,
                    role: userInfoResponse.role || "user",
                };
                setUser(userInfo);
                localStorage.setItem("user", JSON.stringify(userInfo));

                return { success: true, user: userInfo };
            } else {
                return { success: false, message: "登录失败：未获取到有效token" };
            }
        } catch (error) {
            console.error("登录错误:", error);
            return {
                success: false,
                message: error.response?.data?.message || "登录失败，用户名或密码错误",
            };
        }
    };

    // 登出函数
    const logout = () => {
        setUser(null);
        clearToken();
        navigate("/login");
    };

    // 检查用户是否已登录
    const isAuthenticated = () => {
        return !!user;
    };

    // 提供上下文值
    const value = {
        user,
        loading,
        login,
        logout,
        isAuthenticated,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// 自定义钩子，用于在组件中访问认证上下文
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
