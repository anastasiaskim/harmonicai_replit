import React from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { setCurrentAudioIndex, clearHistory } from '../../store/slices/ttsSlice';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Paper,
  Stack,
  Button,
} from '@mui/material';
import {
  PlayArrow,
  Delete,
  History as HistoryIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';

interface HistoryViewProps {
  className?: string;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ className }) => {
  const dispatch = useAppDispatch();
  const { recentConversions } = useAppSelector((state) => state.tts);

  const handlePlay = (index: number) => {
    dispatch(setCurrentAudioIndex(index));
  };

  const handleClearHistory = () => {
    dispatch(clearHistory());
  };

  if (recentConversions.length === 0) {
    return (
      <Paper
        className={className}
        sx={{
          p: 3,
          borderRadius: 2,
          backgroundColor: 'background.paper',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        }}
      >
        <Stack spacing={2} alignItems="center">
          <HistoryIcon color="action" sx={{ fontSize: 48 }} />
          <Typography variant="h6" color="text.secondary">
            No conversion history
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center">
            Your recent text-to-speech conversions will appear here
          </Typography>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper
      className={className}
      sx={{
        p: 3,
        borderRadius: 2,
        backgroundColor: 'background.paper',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
      }}
    >
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HistoryIcon color="primary" />
            <Typography variant="h6">Recent Conversions</Typography>
          </Box>
          <Button
            startIcon={<Delete />}
            onClick={handleClearHistory}
            color="error"
            size="small"
          >
            Clear History
          </Button>
        </Box>

        <List>
          {recentConversions.map((conversion, index) => (
            <ListItem
              key={conversion.id}
              sx={{
                borderRadius: 1,
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
              secondaryAction={
                <IconButton
                  edge="end"
                  onClick={() => handlePlay(index)}
                  color="primary"
                >
                  <PlayArrow />
                </IconButton>
              }
            >
              <ListItemText
                primary={conversion.text || 'Untitled Conversion'}
                secondary={formatDistanceToNow(conversion.timestamp, { addSuffix: true })}
              />
            </ListItem>
          ))}
        </List>
      </Stack>
    </Paper>
  );
}; 