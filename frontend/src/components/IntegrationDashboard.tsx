import React, { useEffect, useState, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemText,
  Paper,
  Alert
} from '@mui/material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  CheckCircleOutline,
  Error,
  HourglassEmpty,
  Loop
} from '@mui/icons-material';

// Registrar componentes Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface Task {
  agentId: string;
  taskName: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  percentage: number;
  timestamp: number;
}

interface ProgressUpdate {
  type: string;
  agentId?: string;
  taskName?: string;
  status?: string;
  percentage?: number;
  globalProgress?: number;
  tasks?: Task[];
  activeAgents?: string[];
  timestamp: number;
}

export const IntegrationDashboard: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [globalProgress, setGlobalProgress] = useState(0);
  const [activeAgents, setActiveAgents] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    completed: 0,
    inProgress: 0,
    pending: 0,
    errors: 0
  });

  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    connectSSE();

    return () => {
      disconnectSSE();
    };
  }, []);

  useEffect(() => {
    // Atualizar estatísticas quando tasks mudarem
    const completed = tasks.filter(t => t.status === 'completed').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const pending = tasks.filter(t => t.status === 'pending').length;
    const errors = tasks.filter(t => t.status === 'error').length;

    setStats({ completed, inProgress, pending, errors });
  }, [tasks]);

  const connectSSE = () => {
    try {
      const eventSource = new EventSource('http://localhost:3001/api/integration/progress-stream');
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('✅ Conectado ao servidor SSE');
        setIsConnected(true);
        setError(null);
      };

      eventSource.onmessage = (event) => {
        try {
          const data: ProgressUpdate = JSON.parse(event.data);
          handleProgressUpdate(data);
        } catch (err) {
          console.error('Erro ao parsear mensagem SSE:', err);
        }
      };

      eventSource.onerror = (err) => {
        console.error('Erro SSE:', err);
        setIsConnected(false);
        setError('Conexão perdida. Tentando reconectar...');

        // Tentar reconectar após 3 segundos
        setTimeout(() => {
          disconnectSSE();
          connectSSE();
        }, 3000);
      };
    } catch (err) {
      console.error('Erro ao conectar SSE:', err);
      setError('Falha ao conectar ao servidor de progresso');
    }
  };

  const disconnectSSE = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }
  };

  const handleProgressUpdate = (data: ProgressUpdate) => {
    switch (data.type) {
      case 'initial-state':
        if (data.tasks) setTasks(data.tasks);
        if (data.globalProgress !== undefined) setGlobalProgress(data.globalProgress);
        if (data.activeAgents) setActiveAgents(data.activeAgents);
        break;

      case 'task-update':
        if (data.agentId && data.taskName) {
          setTasks(prev => {
            const existingIndex = prev.findIndex(
              t => t.agentId === data.agentId && t.taskName === data.taskName
            );

            const newTask: Task = {
              agentId: data.agentId!,
              taskName: data.taskName!,
              status: data.status as Task['status'],
              percentage: data.percentage || 0,
              timestamp: data.timestamp
            };

            if (existingIndex >= 0) {
              const newTasks = [...prev];
              newTasks[existingIndex] = newTask;
              return newTasks;
            } else {
              return [...prev, newTask];
            }
          });

          if (data.globalProgress !== undefined) {
            setGlobalProgress(data.globalProgress);
          }
        }
        break;

      case 'agent-start':
        if (data.agentId) {
          setActiveAgents(prev =>
            prev.includes(data.agentId!) ? prev : [...prev, data.agentId!]
          );
        }
        break;

      case 'agent-complete':
        if (data.agentId) {
          setActiveAgents(prev => prev.filter(id => id !== data.agentId));
        }
        break;
    }
  };

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircleOutline style={{ color: '#4caf50' }} />;
      case 'in_progress':
        return <Loop style={{ color: '#2196f3' }} className="rotating-icon" />;
      case 'error':
        return <Error style={{ color: '#f44336' }} />;
      default:
        return <HourglassEmpty style={{ color: '#9e9e9e' }} />;
    }
  };

  const getStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in_progress':
        return 'primary';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  // Dados para gráfico de barras
  const barChartData = {
    labels: Array.from(new Set(tasks.map(t => t.agentId))),
    datasets: [{
      label: 'Tarefas Concluídas',
      data: Array.from(new Set(tasks.map(t => t.agentId))).map(agentId =>
        tasks.filter(t => t.agentId === agentId && t.status === 'completed').length
      ),
      backgroundColor: 'rgba(75, 192, 192, 0.6)',
      borderColor: 'rgba(75, 192, 192, 1)',
      borderWidth: 1
    }, {
      label: 'Em Progresso',
      data: Array.from(new Set(tasks.map(t => t.agentId))).map(agentId =>
        tasks.filter(t => t.agentId === agentId && t.status === 'in_progress').length
      ),
      backgroundColor: 'rgba(54, 162, 235, 0.6)',
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 1
    }]
  };

  // Dados para gráfico de pizza
  const doughnutChartData = {
    labels: ['Concluídas', 'Em Progresso', 'Pendentes', 'Erros'],
    datasets: [{
      data: [stats.completed, stats.inProgress, stats.pending, stats.errors],
      backgroundColor: [
        'rgba(75, 192, 192, 0.6)',
        'rgba(54, 162, 235, 0.6)',
        'rgba(201, 203, 207, 0.6)',
        'rgba(255, 99, 132, 0.6)'
      ],
      borderColor: [
        'rgba(75, 192, 192, 1)',
        'rgba(54, 162, 235, 1)',
        'rgba(201, 203, 207, 1)',
        'rgba(255, 99, 132, 1)'
      ],
      borderWidth: 1
    }]
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Typography variant="h4" gutterBottom>
        Integração de 86 Ferramentas
      </Typography>

      {/* Status de Conexão */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {isConnected && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Conectado ao servidor de progresso em tempo real
        </Alert>
      )}

      {/* Progresso Global */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Progresso Global: {globalProgress.toFixed(1)}%
          </Typography>
          <LinearProgress
            variant="determinate"
            value={globalProgress}
            sx={{ height: 10, borderRadius: 5 }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {stats.completed} de {tasks.length} tarefas concluídas
          </Typography>
        </CardContent>
      </Card>

      {/* Agentes Ativos */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Agentes Ativos ({activeAgents.length})
          </Typography>
          <Grid container spacing={2}>
            {activeAgents.map(agentId => (
              <Grid item xs={12} sm={6} md={3} key={agentId}>
                <Paper
                  elevation={3}
                  sx={{
                    p: 2,
                    textAlign: 'center',
                    backgroundColor: '#e3f2fd'
                  }}
                >
                  <Typography variant="h3">🤖</Typography>
                  <Typography variant="body1" fontWeight="bold">
                    {agentId}
                  </Typography>
                  <Chip
                    label="Trabalhando..."
                    color="primary"
                    size="small"
                    sx={{ mt: 1 }}
                  />
                </Paper>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* Gráficos */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Progresso por Agente
              </Typography>
              <Bar data={barChartData} />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Status das Tarefas
              </Typography>
              <Doughnut data={doughnutChartData} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Lista de Tarefas em Tempo Real */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Tarefas (Total: {tasks.length})
          </Typography>
          <List sx={{ maxHeight: 500, overflow: 'auto' }}>
            {tasks.slice().reverse().map((task, idx) => (
              <ListItem
                key={`${task.agentId}-${task.taskName}-${idx}`}
                sx={{
                  borderLeft: `4px solid ${
                    task.status === 'completed' ? '#4caf50' :
                    task.status === 'in_progress' ? '#2196f3' :
                    task.status === 'error' ? '#f44336' :
                    '#9e9e9e'
                  }`,
                  mb: 1,
                  backgroundColor: '#f5f5f5',
                  borderRadius: 1
                }}
              >
                {getStatusIcon(task.status)}
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center">
                      <Typography variant="body1" sx={{ mr: 2 }}>
                        {task.taskName}
                      </Typography>
                      <Chip
                        label={task.agentId}
                        size="small"
                        variant="outlined"
                        sx={{ mr: 1 }}
                      />
                      <Chip
                        label={task.status}
                        size="small"
                        color={getStatusColor(task.status) as any}
                      />
                    </Box>
                  }
                  secondary={
                    <Box>
                      <LinearProgress
                        variant="determinate"
                        value={task.percentage}
                        sx={{ mt: 1, mb: 0.5 }}
                      />
                      <Typography variant="caption">
                        {task.percentage.toFixed(0)}% - {new Date(task.timestamp).toLocaleTimeString()}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>

      {/* CSS para animação */}
      <style>{`
        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .rotating-icon {
          animation: rotate 2s linear infinite;
        }
      `}</style>
    </Box>
  );
};

export default IntegrationDashboard;
