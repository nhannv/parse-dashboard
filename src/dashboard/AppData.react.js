/*
 * Copyright (c) 2016-present, Parse, LLC
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */
import React       from 'react';
import PropTypes   from 'lib/PropTypes';
import AppSelector from 'dashboard/AppSelector.react';
import AppsManager from 'lib/AppsManager';
import history     from 'dashboard/history';
import ParseApp    from 'lib/ParseApp';
import createClass from 'create-react-class';

let AppData = createClass({
  childContextTypes: {
    generatePath: PropTypes.func,
    currentApp: PropTypes.instanceOf(ParseApp)
  },

  getChildContext() {
    return {
      generatePath: this.generatePath,
      currentApp: this.props.apps.find(ap => ap.slug === this.props.params.appId)
    };
  },

  generatePath(path) {
    return '/apps/' + this.props.params.appId + '/' + path;
  },

  render() {
    if (this.props.params.appId === '_') {
      return <AppSelector />;
    }
    //Find by name to catch edge cases around escaping apostrophes in URLs
    let current = this.props.apps.find(ap => ap.slug === this.props.params.appId);
    if (current) {
      current.setParseKeys();
    } else {
      history.replace('/apps');
      return <div />;
    }
    return (
      <div>
        {this.props.children}
      </div>
    );
  }
});

export default AppData;
