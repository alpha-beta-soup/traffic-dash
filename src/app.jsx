import React from 'react';

import AppBar from './components/AppBar';
import AppGrid from './components/AppGrid';

export default class App extends React.Component {
  render() {
    return (
      <div className={"main"}>
        <AppBar/>
        <AppGrid/>
      </div>
    );
  }
}
