/*
 * Copyright (c) 2016-present, Parse, LLC
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */
import { ActionTypes }        from 'lib/stores/JobsStore';
import Button                 from 'components/Button/Button.react';
import * as DateUtils         from 'lib/DateUtils';
import CategoryList           from 'components/CategoryList/CategoryList.react';
import EmptyState             from 'components/EmptyState/EmptyState.react';
import history                from 'dashboard/history';
import Icon                   from 'components/Icon/Icon.react';
import Modal                  from 'components/Modal/Modal.react';
import React                  from 'react';
import ReleaseInfo            from 'components/ReleaseInfo/ReleaseInfo';
import RunNowButton           from 'dashboard/Data/Jobs/RunNowButton.react';
import SidebarAction          from 'components/Sidebar/SidebarAction';
import StatusIndicator        from 'components/StatusIndicator/StatusIndicator.react';
import styles                 from 'dashboard/Data/Jobs/Jobs.scss';
import browserStyles          from 'dashboard/Data/Browser/Browser.scss';
import subscribeTo            from 'lib/subscribeTo';
import TableHeader            from 'components/Table/TableHeader.react';
import TableView              from 'dashboard/TableView.react';
import Toolbar                from 'components/Toolbar/Toolbar.react';

let subsections = {
  all: 'All Jobs',
  /*scheduled: 'Scheduled Jobs',*/
  status: 'Job Status'
};

let statusColors = {
  succeeded: 'green',
  failed: 'red',
  running: 'blue'
};

function scheduleString(data) {
  let schedule = '';
  if (data.repeatMinutes) {
    if (data.repeatMinutes === 1440) {
      schedule += 'Every day, ';
    } else if (data.repeatMinutes > 60) {
      schedule += 'Each day, every ' + ((data.repeatMinutes / 60) | 0) + ' hours, ';
    } else {
      schedule += 'Each day, every ' + data.repeatMinutes + ' minutes, ';
    }
    schedule += 'after ' + data.timeOfDay.substr(0, 5) + ', ';
    schedule += 'starting ';
  } else {
    schedule = 'On ';
  }
  let runAt = new Date(data.startAfter);
  schedule += runAt.getUTCMonth() + '/' + runAt.getUTCDate() + '/' + String(runAt.getUTCFullYear()).substr(2);
  schedule += ' at ' + (runAt.getUTCHours() < 10 ? '0' : '') + runAt.getUTCHours() + ':' + (runAt.getUTCMinutes() < 10 ? '0' : '') + runAt.getUTCMinutes() + '.';
  return <div style={{ fontSize: 12, whiteSpace: 'normal', lineHeight: '16px' }}>{schedule}</div>;
}

// TODO: create scrollable view component that handles lazy fetch container on scroll
export default
@subscribeTo('Jobs', 'jobs')
class Jobs extends TableView {
  constructor() {
    super();
    this.section = 'Cloud Code';
    this.subsection = 'Jobs';

    this.state = {
      toDelete: null,
      jobStatus: undefined,
      loading: true,
      // Properties used to control data access
      hasPermission: true,
      errorMessage: ""
    };
  }

  componentWillMount() {
    this.loadData();
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.availableJobs) {
      if (nextProps.availableJobs.length > 0) {
        this.action = new SidebarAction('Schedule a job', this.navigateToNew.bind(this));
        return;
      }
    }
    // check if the changes are in currentApp serverInfo status
    // if not return without making any request
    if (this.props.apps !== nextProps.apps) {
      let updatedCurrentApp = nextProps.apps.find(ap => ap.slug === this.props.params.appId);
      let prevCurrentApp = this.props.apps.find(ap => ap.slug === this.props.params.appId);
      const shouldUpdate = updatedCurrentApp.serverInfo.status !== prevCurrentApp.serverInfo.status;
      if (!shouldUpdate) return;
    }
    this.action = null;
    this.loadData();
  }

  navigateToNew() {
    history.push(this.context.generatePath('jobs/new'));
  }

  navigateToJob(jobId) {
    history.push(this.context.generatePath(`jobs/edit/${jobId}`))
  }

  loadData() {
    this.props.jobs.dispatch(ActionTypes.FETCH).finally(() => {
      let err
      err = this.props.jobs.data && this.props.jobs.data.get('err')
      // Verify error message, used to control collaborators permissions
      if (err && err.code === 403)
        this.setState({
          loading: false,
          hasPermission: false,
          errorMessage: err.message
        });
      // If is a unexpected error just finish loading state
      else this.setState({ loading: false });
      this.renderEmpty()
    });
    this.context.currentApp.getJobStatus().then((status) => {
      this.setState({ jobStatus: status });
    }).catch(() => {
      this.setState({ jobStatus: [] });
    });
  }

  renderSidebar() {
    let current = this.props.params.section || '';
    return (
      <CategoryList current={current} linkPrefix={'jobs/'} categories={[
       /* { name: 'Scheduled Jobs', id: 'scheduled' }, */
        { name: 'All Jobs', id: 'all' },
        { name: 'Job Status', id: 'status' }
      ]} />
    );
  }

  renderRow(data) {
    // Just render rows if user has permission to access data
    if (!this.state.hasPermission) return
    if (this.props.params.section === 'all') {
      return (
        <tr key={data.jobName}>
          <td style={{width: '60%'}}>{data.jobName}</td>
          <td className={styles.buttonCell}>
            <RunNowButton job={data} width={'100px'} />
          </td>
        </tr>
      );
    } else if (this.props.params.section === 'scheduled') {
      return (
        <tr key={data.objectId}>
          <td style={{width: '20%'}}>{data.description}</td>
          <td style={{width: '20%'}}>{data.jobName}</td>
          <td style={{width: '20%'}}>{scheduleString(data)}</td>
          <td className={styles.buttonCell}>
            <RunNowButton job={data} width={'100px'} />
            <Button width={'80px'} value='Edit' onClick={() => this.navigateToJob(data.objectId)} />
            <Button width={'80px'} color='red' value='Delete' onClick={() => this.setState({ toDelete: data.objectId })} />
          </td>
        </tr>
      );
    } else if (this.props.params.section === 'status') {
      return (
        <tr key={data.objectId}>
          <td style={{width: '20%'}}>{data.jobName}</td>
          <td style={{width: '20%'}}>{DateUtils.dateStringUTC(new Date(data.createdAt))}</td>
          <td style={{width: '20%'}}>{data.finishedAt ? DateUtils.dateStringUTC(new Date(data.finishedAt.iso)) : ''}</td>
          <td style={{width: '20%'}}>
            <div style={{ fontSize: 12, whiteSpace: 'normal', lineHeight: '16px' }}>
              {data.message}
            </div>
          </td>
          <td style={{width: '20%'}}>
            <StatusIndicator text={data.status} color={statusColors[data.status]} />
          </td>
        </tr>
      );
    }
  }

  renderHeaders() {
    if (this.props.params.section === 'all') {
      return [
        <TableHeader key='name' width={60}>Name</TableHeader>,
        <TableHeader key='actions' width={40}>Actions</TableHeader>,
      ];
    } else if (this.props.params.section === 'scheduled') {
      return [
        <TableHeader key='name' width={20}>Name</TableHeader>,
        <TableHeader key='func' width={20}>Function</TableHeader>,
        <TableHeader key='schedule' width={20}>Schedule (UTC)</TableHeader>,
        <TableHeader key='actions' width={40}>Actions</TableHeader>,
      ];
    } else {
      return [
        <TableHeader key='func' width={20}>Function</TableHeader>,
        <TableHeader key='started' width={20}>Started At (UTC)</TableHeader>,
        <TableHeader key='finished' width={20}>Finished At (UTC)</TableHeader>,
        <TableHeader key='message' width={20}>Message</TableHeader>,
        <TableHeader key='status' width={20}>Status</TableHeader>,
      ];
    }
  }

  renderEmpty() {
    if (!this.state.hasPermission) {
      // Permission denied state
      return (
        <EmptyState
          title='Cloud Jobs'
          description={this.state.errorMessage}
          icon='cloud-unsure' />
      )
    }
    if (this.props.params.section === 'all') {
      return (
        <EmptyState
          title='Cloud Jobs'
          description='Define Jobs on parse-server with Parse.Cloud.job()'
          icon='cloud-happy' />
      );
    } else if (this.props.params.section === 'scheduled') {
      return (
        <EmptyState
          title='Cloud Jobs'
          description='Scheduling jobs is not supported on parse-server'
          icon='cloud-happy' />
      );
    } else {
      return (
        <EmptyState
          title='Job Status'
          description='There are no active jobs to show at this time.'
          icon='cloud-unsure' />
      );
    }
  }

  renderExtras() {
    if (this.state.toDelete) {
      return (
        <Modal
          type={Modal.Types.DANGER}
          title='Delete job schedule?'
          subtitle='Careful, this action cannot be undone'
          confirmText='Yes, delete it'
          cancelText={'Never mind, don\'t'}
          onCancel={() => this.setState({ toDelete: null })}
          onConfirm={() => {
            this.setState({ toDelete: null });
            this.props.jobs.dispatch(ActionTypes.DELETE, { jobId: this.state.toDelete });
          }} />
      );
    }
  }

  tableData() {
    // Return a empty array if user don't have permission to read scheduled jobs
    if (!this.state.hasPermission) return []
    let data = undefined;
    if (this.props.params.section === 'scheduled' || this.props.params.section === 'all' ) {
      if (this.props.jobs.data) {
        let jobs = this.props.jobs.data.get('jobs');
        if (jobs) {
          data = jobs.toArray();
        }
      }
    } else {
      return this.state.jobStatus;
    }
    return data;
  }

  onRefresh() {
    this.setState({
      toDelete: null,
      jobStatus: undefined,
      loading: true,
    });
    this.loadData();
  }

  renderToolbar() {
    if (subsections[this.props.params.section]) {
      return (
        <Toolbar
          section='Jobs'
          subsection={subsections[this.props.params.section]}
          details={ReleaseInfo({ release: this.props.release })}>
          <a className={browserStyles.toolbarButton} onClick={this.onRefresh.bind(this)}>
            <Icon name='refresh-solid' width={14} height={14} />
            <span>Refresh</span>
          </a>
          {this.props.availableJobs && this.props.availableJobs.length > 0 ?
            <Button color='white' value='Schedule a job' onClick={this.navigateToNew.bind(this)} /> : null}
        </Toolbar>
      );
    }
    return null;
  }
}
