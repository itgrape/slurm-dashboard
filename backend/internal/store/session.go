package store

import (
	"os"
	"os/exec"
	"sync"
)

// InteractiveSession 保存了一个正在运行的后台命令所需的所有信息
type InteractiveSession struct {
	ID       string
	Username string
	Cmd      *exec.Cmd
	Pty      *os.File // 伪终端的引用
	mu       sync.RWMutex
}

// SessionStore 是一个线程安全的内存会话存储，用于交互式会话信息的保存
type SessionStore struct {
	sessions map[string]*InteractiveSession
	mu       sync.RWMutex
}

// GetPty 安全地获取 Pty
func (s *InteractiveSession) GetPty() *os.File {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.Pty
}

func NewSessionStore() *SessionStore {
	return &SessionStore{
		sessions: make(map[string]*InteractiveSession),
	}
}

func (s *SessionStore) Add(session *InteractiveSession) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessions[session.ID] = session
}

func (s *SessionStore) Get(id string) (*InteractiveSession, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	session, ok := s.sessions[id]
	return session, ok
}

func (s *SessionStore) Remove(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if session, ok := s.sessions[id]; ok {
		if pty := session.GetPty(); pty != nil {
			pty.Close()
		}
	}
	delete(s.sessions, id)
}
