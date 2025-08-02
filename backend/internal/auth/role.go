package auth

import (
	"log"
	"os/exec"
	"strings"
)

// CheckAdminStatus 检查用户是否为管理员。
// 管理员条件: 用户组包含 wheel, root, 或 sudo。
func CheckAdminStatus(username string) string {
	adminGroups := map[string]struct{}{
		"wheel": {},
		"root":  {},
		"sudo":  {},
	}
	cmd := exec.Command("groups", username)
	output, err := cmd.Output()
	if err != nil {
		log.Printf("Could not check groups for user %s: %v. Defaulting to 'user' role.", username, err)
		return "user"
	}
	// groups 命令的输出为 'username : group1 group2 ...'
	parts := strings.SplitN(string(output), ":", 2)
	groupsStr := string(output)
	if len(parts) == 2 {
		groupsStr = parts[1]
	}

	userGroups := strings.Fields(groupsStr)
	for _, group := range userGroups {
		if _, isAdminGroup := adminGroups[group]; isAdminGroup {
			return "admin"
		}
	}

	return "user"
}
