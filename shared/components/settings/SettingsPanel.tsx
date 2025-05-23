import React from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { updateSettings, setVoice } from '../../store/slices/ttsSlice';
import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  Divider,
  Stack,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { Settings as SettingsIcon } from '@mui/icons-material';

interface SettingsPanelProps {
  className?: string;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ className }) => {
  const dispatch = useAppDispatch();
  const { settings, selectedVoice } = useAppSelector((state) => state.tts);

  const handleSettingChange = (key: keyof typeof settings) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    dispatch(updateSettings({ [key]: event.target.checked }));
  };

  const handleVoiceChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    const newVoice = event.target.value as string;
    dispatch(setVoice(newVoice));
  };

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
      <Stack spacing={3}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SettingsIcon color="primary" />
          <Typography variant="h6">Settings</Typography>
        </Box>

        <Divider />

        {/* Playback Settings */}
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            Playback
          </Typography>
          <Stack spacing={2}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.autoPlay}
                  onChange={handleSettingChange('autoPlay')}
                  color="primary"
                />
              }
              label="Auto-play after conversion"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.highQuality}
                  onChange={handleSettingChange('highQuality')}
                  color="primary"
                />
              }
              label="High quality audio"
            />
          </Stack>
        </Box>

        <Divider />

        {/* History Settings */}
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            History
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={settings.saveHistory}
                onChange={handleSettingChange('saveHistory')}
                color="primary"
              />
            }
            label="Save conversion history"
          />
        </Box>

        <Divider />

        {/* Voice Settings */}
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            Voice Settings
          </Typography>
          <FormControl fullWidth>
            <InputLabel>Voice</InputLabel>
            <Select
              value={selectedVoice}
              onChange={handleVoiceChange}
              label="Voice"
            >
              <MenuItem value="default">Default Voice</MenuItem>
              <MenuItem value="male">Male Voice</MenuItem>
              <MenuItem value="female">Female Voice</MenuItem>
              {/* Add more voice options as needed */}
            </Select>
          </FormControl>
        </Box>

        {/* Additional Settings */}
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            Advanced Settings
          </Typography>
          <Stack spacing={2}>
            <FormControlLabel
              control={
                <Switch
                  checked={false}
                  onChange={() => {}}
                  color="primary"
                />
              }
              label="Enable keyboard shortcuts"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={false}
                  onChange={() => {}}
                  color="primary"
                />
              }
              label="Show waveform visualization"
            />
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}; 