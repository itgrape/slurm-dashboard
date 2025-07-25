package services

import (
	"fmt"
	"os"
	"os/exec"
	"os/user"
	"strconv"
	"syscall"
)

func ExecuteCommandAsUser(username string, command string) (string, error) {
	osUser, err := user.Lookup(username)
	if err != nil {
		return "", fmt.Errorf("failed to lookup user %s: %w", username, err)
	}
	uid, _ := strconv.Atoi(osUser.Uid)
	gid, _ := strconv.Atoi(osUser.Gid)

	cmd := exec.Command("bash", "-c", command)
	cmd.Dir = osUser.HomeDir

	cmd.SysProcAttr = &syscall.SysProcAttr{}
	cmd.SysProcAttr.Credential = &syscall.Credential{Uid: uint32(uid), Gid: uint32(gid)}

	cmd.Env = []string{
		"TERM=xterm",
		fmt.Sprintf("HOME=%s", osUser.HomeDir),
		fmt.Sprintf("USER=%s", username),
		fmt.Sprintf("LOGNAME=%s", username),
		fmt.Sprintf("PATH=%s", os.Getenv("PATH")),
	}

	output, err := cmd.CombinedOutput()
	if err != nil {
		return string(output), fmt.Errorf("failed to execute command as user %s: %w", username, err)
	}

	return string(output), nil
}
