/*
 * Copyright (c) 2016-present, Parse, LLC
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */
import React           from 'react';
import { withRouter, Prompt }  from 'react-router';
import history         from 'dashboard/history';
import $               from 'jquery';
import axios           from 'axios';
import B4AAlert        from 'components/B4AAlert/B4AAlert.react';
import Button          from 'components/Button/Button.react';
import B4ACodeTree     from 'components/B4ACodeTree/B4ACodeTree.react';
import {
  getFiles,
  updateTreeContent
}                      from 'components/B4ACodeTree/B4ATreeActions';
import B4ACloudCodeToolbar    from 'dashboard/Data/CloudCode/B4ACloudCodeToolbar.react';
import CloudCode       from 'dashboard/Data/CloudCode/CloudCode.react';

class B4ACloudCode extends CloudCode {
  constructor() {
    super();
    this.section = 'Cloud Code';
    this.subsection = 'Functions & Web Hosting';

    this.appsPath = 'parse-app'

    // Parameters used to on/off alerts
    this.alertTips = 'showTips'
    this.alertWhatIs= 'showWhatIs'

    this.state = {
      // property to keep the persisted cloud code files
      files: undefined,
      loading: true,
      unsavedChanges: false,
      modal: null,
      codeUpdated: false,
      updatedFiles: [],

      // Parameters used to on/off alerts
      showTips: localStorage.getItem(this.alertTips) !== 'false',
      showWhatIs: localStorage.getItem(this.alertWhatIs) !== 'false'
    };

    this.onLogClick = this.onLogClick.bind(this);
  }

  // Method used to handler the B4AAlerts closed (that divs with some tips) and
  // save this action at Local Storage to persist data.
  handlerCloseAlert(alertTitle) {
    // identify the alert name based on received alert title
    let alertName = (alertTitle.indexOf('Tips') >= 0 ? this.alertTips : this.alertWhatIs)
    localStorage.setItem(alertName, 'false')
  }

  // Return the cloud code API path
  getPath() {
    return `${b4aSettings.BACK4APP_API_PATH}/${this.appsPath}/${this.props.params.appId}/cloud`
  }

  async componentWillMount() {
    typeof back4AppNavigation === 'object' && back4AppNavigation.atCloudCodePageEvent()
    await this.fetchSource()
    // define the parameters to show unsaved changes warning modal
    const unbindHook = this.props.history.block(nextLocation => {
      if (this.state.unsavedChanges) {
        const warningModal = <Modal
          type={Modal.Types.WARNING}
          icon='warn-triangle-solid'
          title="Undeployed changes!"
          buttonsInCenter={true}
          textModal={true}
          confirmText='Continue anyway'
          onConfirm={() => {
            unbindHook();
            history.push(nextLocation);
          }}
          onCancel={() => { this.setState({ modal: null }); }}
          children='There are undeployed changes, if you leave the page you will lose it.'
          />;
        this.setState({ modal: warningModal });
        return false;
      } else {
        unbindHook();
      }
    });
  }

  componentDidUpdate() {
    if ( this.state.codeUpdated === true || this.state.unsavedChanges === true ) {
      window.onbeforeunload = function() {
        this.onBeforeUnloadSaveCode = window.onbeforeunload = function() {
          return '';
        }
      }
    } else {
      window.onbeforeunload = undefined;
    }
  }

  componentWillUnmount() {
    if (this.onBeforeUnloadSaveCode) {
      window.removeEventListener('onbeforeunload',this.onBeforeUnloadSaveCode);
    }
  }

  // Format object to expected backend pattern
  formatFiles(nodes, parent) {
    nodes.forEach(node => {
      let file = node;

      // Remove 'new-' prefix from files that will be deployed
      let currentFile = { text: file.text, type: file.type.split('new-').pop() };
      currentFile.type = (currentFile.type === 'file' ? 'default' : currentFile.type)

      parent.push(currentFile);
      if (currentFile.type === 'folder') {
        currentFile.children = [];
        // If is a folder, call formatFiles recursively
        this.formatFiles(file.children, currentFile.children);
      } else {
        currentFile.data = file.data;
      }
    })
  }

  async uploadCode() {
    let tree = [];
    // Get current files on tree
    let currentCode = $('#tree').jstree().get_json();
    const missingFileModal = (
      <Modal
        type={Modal.Types.DANGER}
        icon='warn-triangle-solid'
        title='Missing required file'
        children='The cloud folder must contain either main.js or app.js file, and must be placed on the root of the folder.'
        showCancel={false}
        textModal={true}
        confirmText='Ok, got it'
        buttonsInCenter={true}
        onConfirm={() => {
          this.setState({ modal: null });
        }} />
    );

    // get files in cloud folder
    let cloudCode = currentCode.find(code => code.text === 'cloud');
    if (!cloudCode) {
      // show modal for missing main.js or app.js
      return this.setState({ modal: missingFileModal });
    }
    // check main.js or app.js file on cloud folder
    let fileIdx = cloudCode.children.findIndex(file => file.text === 'main.js' || file.text === 'app.js');
    if (fileIdx === -1) {
      // show modal for missing main.js or app.js
      return this.setState({ modal: missingFileModal });
    }

    this.formatFiles(currentCode, tree);
    const loadingModal = <Modal
      type={Modal.Types.INFO}
      icon='files-outline'
      title='Deploying...'
      textModal={true}
      children={
        <div>
          <LoaderDots />
          <div>
            Please wait, deploying in progress...
          </div>
        </div>
      }
      customFooter={<div style={{ padding: '10px 0 20px' }}></div>}
      />;
    // show 'loading' modal
    this.setState({ modal: loadingModal });
    try{
      await axios(this.getPath(), {
        method: "post",
        data: { tree },
        withCredentials: true
      })
      back4AppNavigation && back4AppNavigation.deployCloudCodeEvent()
      await this.fetchSource()
      // force jstree component to upload
      await updateTreeContent(this.state.files)
      const successModal = <Modal
        type={Modal.Types.VALID}
        icon='check'
        title='Success on deploying your changes!'
        showCancel={false}
        buttonsInCenter={true}
        confirmText='Ok, got it'
        onConfirm={() => this.setState({ modal: null })}
        />;
      this.setState({ unsavedChanges: false, modal: successModal, codeUpdated: false });
      $('#tree').jstree(true).redraw(true);
    } catch (err) {
      const errorModal = <Modal
        type={Modal.Types.DANGER}
        icon='warn-triangle-solid'
        title='Something went wrong'
        children='Please try to deploy your changes again.'
        showCancel={false}
        textModal={true}
        confirmText='Ok, got it'
        buttonsInCenter={true}
        onConfirm={() => {
          this.setState({ modal: null });
        }} />;
      this.setState({
        modal: errorModal
      });
    }
  }

  // method used to fetch the cloud code from app
  async fetchSource() {
    try {
      let response = await axios.get(this.getPath(), { withCredentials: true })
      if (response.data && response.data.tree)
        this.setState({ files: response.data.tree, loading: false })
    } catch(err) {
      console.error(err)
      this.setState({ loading: false })
    }
  }

  onLogClick() {
    window.open(`/apps/${this.context.currentApp.slug}/logs/system`, '_blank');
  }

  // override renderSidebar from cloud code to don't show the files name on sidebar
  renderSidebar() {
    return null
  }

  renderContent() {
    let content = null;
    let title = null;
    let footer = null;
    let alertWhatIs = null;

    let alertWhatIsMessage = <div>
      <p style={{height:"auto"}}>
        First, you must create a file called main.js with all your javascript-based functions inside.
        After that, upload it by clicking on the ADD button and then click on the DEPLOY button.
        For more details, check our Cloud Code guide <a href="https://www.back4app.com/docs/get-started/cloud-functions">https://www.back4app.com/docs/get-started/cloud-functions</a>.
      </p>
    </div>

    // Show loading page before fetch data
    if (this.state.loading) {
      content = <LoaderContainer loading={true} solid={false}>
        <div className={styles.loading}></div>
      </LoaderContainer>
    } else { // render cloud code page

      // title = <div className={styles.title}>
      //   <div><p>Cloud Code Functions</p></div>
      //   <Button
      //     value='LEARN MORE'
      //     primary={true}
      //     onClick={() => window.open('https://www.back4app.com/docs/get-started/cloud-functions', '_blank')} />
      // </div>

      title = <B4ACloudCodeToolbar />

      alertWhatIs = <B4AAlert
        show={true}
        handlerCloseEvent={this.handlerCloseAlert.bind(this)}
        title="How to deploy your functions"
        description={alertWhatIsMessage} />

      content = <B4ACodeTree
        setUpdatedFile={(updatedFiles) => this.setState({ updatedFiles })}
        setCodeUpdated={() => this.setState({ codeUpdated: true })}
        files={this.state.files}
        parentState={this.setState.bind(this)}
        currentApp={this.context.currentApp}
      />

      footer = <div className={styles.footer}>
        <div className={styles.footerContainer}>
          {
            this.state.updatedFiles.length > 0 &&
            <div className={styles.ccStatusIcon}>
              <span className={styles.undeployedCircle}></span> <small>Files pending deploy ({this.state.updatedFiles.length})</small>
            </div>
          }
        </div>
        <div className={styles.footerContainer}>
          <Button
            // value={'Logs'}
            onClick={this.onLogClick}
            // additionalStyles={{}}
            value={
              <div>
                <span style={{ color: '#218BEC' }}>Logs</span>
              </div>}
            primary={true}
            width='20'
            additionalStyles={{ minWidth: '70px', background: 'transparent', color: 'dimgray!important' }}
          />
          <Button
            value={<div className={styles['b4a-cc-deploy-btn']}><Icon name='icon-deploy' fill='#fff' width={17} height={30} /> Deploy</div>}
            primary={true}
            onClick={this.uploadCode.bind(this)}
          />
        </div>
      </div>
    }

    return (
      <div className={`${styles.source} ${styles['b4a-source']}`} >
        <Prompt
          when={this.state.codeUpdated === true}
          message='Your cloud code changes may be lost. Please DEPLOY your changes before closing cloud code.'
        />
        {title}
        {content}
        {footer}
        {this.state.modal}
      </div>
    );
  }
}

export default withRouter(B4ACloudCode);
