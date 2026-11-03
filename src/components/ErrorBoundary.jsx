import { Component } from 'react';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

// Keeps an error in one part of the page (`name`, e.g. "The map") to that part, rather than React
// unmounting the whole page: shows what went wrong there, with a button to try it again afresh
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(`${this.props.name} failed:`, error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <Paper role="alert" sx={{ p: 2, ...this.props.sx }}>
        <Typography variant="subtitle2">{this.props.name} stopped working</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', my: 1, overflowWrap: 'anywhere' }}>{error.message}</Typography>
        <Button size="small" variant="outlined" onClick={() => this.setState({ error: null })}>Try again</Button>
      </Paper>
    );
  }
}
