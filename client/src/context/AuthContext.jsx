import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

// Define the API base URL based on environment
const API_BASE_URL = '/api';

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchCurrentUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setUser(data.user);
      } else {
        logout();
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials) => {
    try {
      console.log('Login request payload:', credentials);
      
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentials)
      });
      
      console.log('Login response status:', response.status);
      const data = await response.json();
      console.log('Login response data:', data);
      
      if (data.success) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser(data.user);
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Login failed' };
      }
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: 'Error connecting to server' };
    }
  };

  const register = async (userData) => {
    try {
      console.log('Register request payload:', userData);
      
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData),
        credentials: 'include'
      });
      
      console.log('Register response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Register response error text:', errorText);
        try {
          const errorJson = JSON.parse(errorText);
          return { success: false, error: errorJson.error || 'Registration failed' };
        } catch (e) {
          return { success: false, error: 'Registration failed with status: ' + response.status };
        }
      }
      
      try {
        const data = await response.json();
        console.log('Register response data:', data);
        
        if (data.success) {
          localStorage.setItem('token', data.token);
          setToken(data.token);
          setUser(data.user);
          return { success: true };
        } else {
          return { success: false, error: data.error || 'Registration failed' };
        }
      } catch (jsonError) {
        console.error("JSON parsing error:", jsonError);
        return { success: false, error: 'Error processing server response' };
      }
    } catch (error) {
      console.error("Register error:", error);
      return { success: false, error: 'Error connecting to server' };
    }
  };

  const googleAuth = async (tokenId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tokenId })
      });
      const data = await response.json();
      if (data.success) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser(data.user);
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error("Google auth error:", error);
      return { success: false, error: 'Error connecting to server' };
    }
  };

  const microsoftAuth = async (accessToken) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/microsoft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ accessToken })
      });
      const data = await response.json();
      if (data.success) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser(data.user);
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error("Microsoft auth error:", error);
      return { success: false, error: 'Error connecting to server' };
    }
  };

  const updateProfile = async (updates) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      const data = await response.json();
      if (data.success) {
        setUser(data.user);
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error("Update profile error:", error);
      return { success: false, error: 'Error connecting to server' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    loading,
    login,
    register,
    googleAuth,
    microsoftAuth,
    updateProfile,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthContext; 