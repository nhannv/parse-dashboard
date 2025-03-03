/*
 * Copyright (c) 2016-present, Parse, LLC
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */
import { ActionTypes }                    from 'lib/stores/SchemaStore';
import { post }                           from 'lib/AJAX';
import AccountManager                     from 'lib/AccountManager';
import AddColumnDialog                    from 'dashboard/Data/Browser/AddColumnDialog.react';
import CategoryList                       from 'components/CategoryList/CategoryList.react';
import CreateClassDialog                  from 'dashboard/Data/Browser/CreateClassDialog.react';
import DashboardView                      from 'dashboard/DashboardView.react';
import DataBrowser                        from 'dashboard/Data/Browser/DataBrowser.react';
import { DefaultColumns, SpecialClasses } from 'lib/Constants';
import DeleteRowsDialog                   from 'dashboard/Data/Browser/DeleteRowsDialog.react';
import DropClassDialog                    from 'dashboard/Data/Browser/DropClassDialog.react';
import EmptyState                         from 'components/EmptyState/EmptyState.react';
import ImportDialog                       from 'dashboard/Data/Browser/ImportDialog.react';
import ImportRelationDialog               from 'dashboard/Data/Browser/ImportRelationDialog.react';
import ExportDialog                       from 'dashboard/Data/Browser/ExportDialog.react';
import AttachRowsDialog                   from 'dashboard/Data/Browser/AttachRowsDialog.react';
import AttachSelectedRowsDialog           from 'dashboard/Data/Browser/AttachSelectedRowsDialog.react';
import CloneSelectedRowsDialog            from 'dashboard/Data/Browser/CloneSelectedRowsDialog.react';
import EditRowDialog                      from 'dashboard/Data/Browser/EditRowDialog.react';
import ExportSelectedRowsDialog           from 'dashboard/Data/Browser/ExportSelectedRowsDialog.react';
import history                            from 'dashboard/history';
import { List, Map }                      from 'immutable';
import Notification                       from 'dashboard/Data/Browser/Notification.react';
import Parse                              from 'parse';
import prettyNumber                       from 'lib/prettyNumber';
import queryFromFilters                   from 'lib/queryFromFilters';
import React                              from 'react';
import RemoveColumnDialog                 from 'dashboard/Data/Browser/RemoveColumnDialog.react';
import semver                             from 'semver/preload.js';
import SidebarAction                      from 'components/Sidebar/SidebarAction';
import stringCompare                      from 'lib/stringCompare';
import styles                             from 'dashboard/Data/Browser/Browser.scss';
import subscribeTo                        from 'lib/subscribeTo';
import * as ColumnPreferences             from 'lib/ColumnPreferences';
import introJs                            from 'intro.js'
import introStyle                         from 'stylesheets/introjs.css';
import Tour                               from 'components/Tour/Tour.react';
import { isMobile }                       from 'lib/browserUtils';
import * as queryString                   from 'query-string';
import { Helmet }                         from 'react-helmet';
import PropTypes                          from 'lib/PropTypes';
import ParseApp                           from 'lib/ParseApp';
import Cookies                            from 'js-cookie';
import Swal                               from 'sweetalert2';
import withReactContent                   from 'sweetalert2-react-content';
import postgresqlImg                      from './postgresql.png';
import PermissionsDialog                  from 'components/PermissionsDialog/PermissionsDialog.react';
import validateEntry                      from 'lib/validateCLPEntry.js';
import PointerKeyDialog                   from 'dashboard/Data/Browser/PointerKeyDialog.react';
import ConfirmDeleteColumnDialog          from './ConfirmDeleteColumnDialog.react';
import { defaultCLPS, protectedCLPs } from '../../../lib/Constants';

// The initial and max amount of rows fetched by lazy loading
const MAX_ROWS_FETCHED = 200;
// Alert Content
const MySwal = withReactContent(Swal);
const postgresqlAlert = {
  text:
    "Thank you for your interest in using Back4App with PostgreSQL. We are working hard to make this database available and will notify you once we release it. In the meantime, we’ve just created your App using MongoDB 3.6, so you can use Back4App.",
  imageUrl: postgresqlImg,
  imageWidth: 200,
  imageAlt: "Postgresql Image"
};

export default
@subscribeTo('Schema', 'schema')
class Browser extends DashboardView {
  constructor() {
    super();
    this.section = 'Database';
    this.subsection = 'Browser'
    this.noteTimeout = null;

    const user = AccountManager.currentUser();

    this.state = {
      showCreateClassDialog: false,
      showAddColumnDialog: false,
      showRemoveColumnDialog: false,
      showDropClassDialog: false,
      showImportDialog: false,
      showImportRelationDialog: false,
      showExportDialog: false,
      showAttachRowsDialog: false,
      showEditRowDialog: false,
      rowsToDelete: null,
      columnToDelete: null,
      rowsToExport: null,

      relation: null,
      counts: {},
      computingClassCounts: false,
      filteredCounts: {},
      clp: {},
      filters: new List(),
      ordering: '-createdAt',
      selection: {},
      uniqueClassFields: new List(),

      data: null,
      lastMax: -1,
      newObject: null,
      editCloneRows: null,

      lastError: null,
      lastNote: null,

      relationCount: 0,

      isUnique: false,
      uniqueField: null,
      keepAddingCols: false,
      showTour: !isMobile() && user && user.playDatabaseBrowserTutorial,
      renderFooterMenu: !isMobile(),
      showPostgresqlModal: !!Cookies.get('isPostgresql'),
      openSecurityDialog: false,

      showPointerKeyDialog: false,
      markRequiredFieldRow: 0,
      requiredColumnFields: [],

      useMasterKey: true,
      currentUser: Parse.User.current()
    };

    this.prefetchData = this.prefetchData.bind(this);
    this.fetchData = this.fetchData.bind(this);
    this.fetchRelation = this.fetchRelation.bind(this);
    this.fetchRelationCount = this.fetchRelationCount.bind(this);
    this.fetchClassIndexes = this.fetchClassIndexes.bind(this);
    this.fetchNextPage = this.fetchNextPage.bind(this);
    this.updateFilters = this.updateFilters.bind(this);
    this.showRemoveColumn = this.showRemoveColumn.bind(this);
    this.showDeleteRows = this.showDeleteRows.bind(this);
    this.showDropClass = this.showDropClass.bind(this);
    this.showExport = this.showExport.bind(this);
    this.showImport = this.showImport.bind(this);
    this.showImportRelation = this.showImportRelation.bind(this);
    this.login = this.login.bind(this);
    this.logout = this.logout.bind(this);
    this.toggleMasterKeyUsage = this.toggleMasterKeyUsage.bind(this);
    this.showAttachRowsDialog = this.showAttachRowsDialog.bind(this);
    this.cancelAttachRows = this.cancelAttachRows.bind(this);
    this.confirmAttachRows = this.confirmAttachRows.bind(this);
    this.showAttachSelectedRowsDialog = this.showAttachSelectedRowsDialog.bind(this);
    this.confirmAttachSelectedRows = this.confirmAttachSelectedRows.bind(this);
    this.cancelAttachSelectedRows = this.cancelAttachSelectedRows.bind(this);
    this.showCloneSelectedRowsDialog = this.showCloneSelectedRowsDialog.bind(this);
    this.confirmCloneSelectedRows = this.confirmCloneSelectedRows.bind(this);
    this.cancelCloneSelectedRows = this.cancelCloneSelectedRows.bind(this);
    this.showExportSelectedRowsDialog = this.showExportSelectedRowsDialog.bind(this);
    this.confirmExportSelectedRows = this.confirmExportSelectedRows.bind(this);
    this.cancelExportSelectedRows = this.cancelExportSelectedRows.bind(this);
    this.getClassRelationColumns = this.getClassRelationColumns.bind(this);
    this.showCreateClass = this.showCreateClass.bind(this);
    this.refresh = this.refresh.bind(this);
    this.selectRow = this.selectRow.bind(this);
    this.updateRow = this.updateRow.bind(this);
    this.updateOrdering = this.updateOrdering.bind(this);
    this.handlePointerClick = this.handlePointerClick.bind(this);
    this.handlePointerCmdClick = this.handlePointerCmdClick.bind(this);
    this.handleCLPChange = this.handleCLPChange.bind(this);
    this.setRelation = this.setRelation.bind(this);
    this.showAddColumn = this.showAddColumn.bind(this);
    this.addRow = this.addRow.bind(this);
    this.abortAddRow = this.abortAddRow.bind(this);
    this.addRowWithModal = this.addRowWithModal.bind(this);
    this.showCreateClass = this.showCreateClass.bind(this);
    this.createClass = this.createClass.bind(this);
    this.addColumn = this.addColumn.bind(this);
    this.addColumnAndContinue = this.addColumnAndContinue.bind(this);
    this.removeColumn = this.removeColumn.bind(this);
    this.showNote = this.showNote.bind(this);
    this.getFooterMenuButtons = this.getFooterMenuButtons.bind(this);
    this.windowResizeHandler = this.windowResizeHandler.bind(this);
    this.onClickIndexManager = this.onClickIndexManager.bind(this);
    this.showEditRowDialog = this.showEditRowDialog.bind(this);
    this.closeEditRowDialog = this.closeEditRowDialog.bind(this);
    this.handleShowAcl = this.handleShowAcl.bind(this);
    this.onDialogToggle = this.onDialogToggle.bind(this);
    this.onClickSecurity = this.onClickSecurity.bind(this);
    this.showPointerKeyDialog = this.showPointerKeyDialog.bind(this);
    this.onChangeDefaultKey = this.onChangeDefaultKey.bind(this);
    this.showColumnDelete = this.showColumnDelete.bind(this);
    this.saveNewRow = this.saveNewRow.bind(this);
    this.addEditCloneRows = this.addEditCloneRows.bind(this);
    this.abortEditCloneRows = this.abortEditCloneRows.bind(this);
    this.abortEditCloneRow = this.abortEditCloneRow.bind(this);
    this.saveEditCloneRow = this.saveEditCloneRow.bind(this);
    this.cancelPendingEditRows = this.cancelPendingEditRows.bind(this);
  }

  getFooterMenuButtons() {
    return this.state.renderFooterMenu || this.state.showTour ? [
      <a key={0} onClick={() => this.setState({ showTour: true })}>Play intro</a>
    ] : null;
  }

  windowResizeHandler() {
    if (isMobile()) {
      this.setState({ renderFooterMenu: false });
    } else {
      this.setState({ renderFooterMenu: true });
    }
  }

  componentWillMount() {
    const { currentApp } = this.context;
    if (!currentApp.preventSchemaEdits) {
      this.action = new SidebarAction('Create a class', this.showCreateClass.bind(this));
    }

    this.props.schema.dispatch(ActionTypes.FETCH)
    .then(() => this.handleFetchedSchema());
    if (!this.props.params.className && this.props.schema.data.get('classes')) {
      this.redirectToFirstClass(this.props.schema.data.get('classes'));
    } else if (this.props.params.className) {
      this.prefetchData(this.props, this.context);
    }
    if (this.state.showPostgresqlModal) {
      MySwal.fire({
        ...postgresqlAlert,
        onAfterClose: () => {
          Cookies.remove('isPostgresql', { domain: 'back4app.com' });
          this.setState({
            showPostgresqlModal: false
          });
        }
      });
    }

    window.addEventListener('resize', this.windowResizeHandler);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.windowResizeHandler);
  }

  componentWillReceiveProps(nextProps, nextContext) {
    if (this.context !== nextContext) {
      if (this.props.params.appId !== nextProps.params.appId || !this.props.params.className) {
        this.setState({ counts: {} });
        Parse.Object._clearAllState();
      }

      // check if the changes are in currentApp serverInfo status
      // if not return without making any request
      if (this.props.apps !== nextProps.apps) {
        let updatedCurrentApp = nextProps.apps.find(
          (ap) => ap.slug === this.props.params.appId
        );
        let prevCurrentApp = this.props.apps.find(
          (ap) => ap.slug === this.props.params.appId
        );
        const shouldUpdate =
          updatedCurrentApp.serverInfo.status !==
          prevCurrentApp.serverInfo.status;

        if (!shouldUpdate) return;
      }

      this.prefetchData(nextProps, nextContext);
      nextProps.schema.dispatch(ActionTypes.FETCH)
      .then(() => this.handleFetchedSchema());
    }
    if (!nextProps.params.className && nextProps.schema.data.get('classes')) {
      this.redirectToFirstClass(nextProps.schema.data.get('classes'));
    }
  }

  getTourConfig() {
    const createClassCode = `
      <section class="intro-code">
        <pre><span class="intro-code-keyword">const</span> B4aVehicle = Parse.Object.extend(<span class="intro-code-string">'B4aVehicle'</span>);</pre>
        <pre><span class="intro-code-keyword">const</span> vehicle = <span class="intro-code-keyword">new</span> B4aVehicle();</pre>
        <br/>
        <pre>vehicle.set('name', <span class="intro-code-string">'Corolla'</span>);</pre>
        <pre>vehicle.set('price', <span class="intro-code-number">19499</span>);</pre>
        <pre>vehicle.set('color', <span class="intro-code-string">'black'</span>);</pre>
        <br/>
        <pre><span class="intro-code-keyword">try</span> {</pre>
        <pre>  <span class="intro-code-keyword">const</span> savedObject = <span class="intro-code-keyword">await</span> vehicle.save(); </pre>
        <pre>  <span class="intro-code-comment">// The class is automatically created on</span></pre>
        <pre>  <span class="intro-code-comment">// the back-end when saving the object!</span></pre>
        <pre>  console.log(savedObject);</pre>
        <pre>} <span class="intro-code-keyword">catch </span>(error) {</pre>
        <pre>  console.error(error);</pre>
        <pre>};</pre>
      </section>
    `;
    const steps = [
      {
        eventId: 'Connect to Back4App',
        intro: `Congratulations, you’ve created your App Backend on Back4App. As a next step, we recommend <a href="https://www.back4app.com/docs/get-started/parse-sdk" style="color: #169CEE">adding Back4App to your App Project.</a>`,
        position: 'center'
      },
      {
        eventId: 'Database Browser Section',
        element: () => document.querySelector('[class^="section_contents"] > div > div'),
        intro: `This is the <b>Database Browser</b> section where you can create classes and manage your data using this Dashboard.`,
        position: 'right'
      },
      {
        eventId: 'Custom Class and Object Creation',
        element: () => document.querySelectorAll('[class^=section__]')[2],
        intro: `It’s very simple to save data on Back4App from your front-end.<br /><br />
        On the <b>API Reference</b> section, you can find the auto-generated code below that creates a class and persist data on it.<br />
        ${createClassCode}
        <p class="intro-code-run">Click on the <b>Run</b> button to execute this code.</p>`,
        position: 'right',
        tooltipClass: 'tourThirdStepStyle'
      },
      {
        eventId: 'Custom Class Link',
        element: () => document.querySelector('[class^=class_list] [title="B4aVehicle"]') || document.querySelector('[class^=class_list]'),
        intro: `This is the new <b>B4aVehicle</b> class just created!`,
        position: 'right'
      },
      {
        eventId: 'Custom Class Data Table',
        element: () => document.querySelector('[class^=browser]'),
        intro: `As you can see the <b>B4aVehicle</b> class already has its first data.`,
        position: 'right'
      },
      {
        eventId: 'Create a Class Button',
        element: () => document.querySelector('[class^="section_contents"] [class^=subitem] a[class^=action]'),
        intro: `You can also create classes and manage your data directly through the Dashboard.`,
        position: 'bottom'
      },
      {
        eventId: 'Play Intro Button',
        element: () => document.querySelector('[class^="footer"] [class^="more"]'),
        intro: `You can find this tour and play it again by pressing this button and selecting <b>"Play intro"</b>.`,
        position: 'right'
      }
    ];
    const { context } = this;
    const { schema } = this.props;
    const { className } = this.props.params;
    const user = AccountManager.currentUser();

    let unexpectedErrorThrown = false;

    const getNextButton = () => {
      return document.querySelector('.introjs-button.introjs-nextbutton');
    };

    const getPrevButton = () => {
      return document.querySelector('.introjs-button.introjs-prevbutton')
    }

    const getCustomVehicleClassLink = () => {
      return document.querySelector('[class^=class_list] [title="B4aVehicle"]');
    };

    const getNextComponentReadyPromise = async conditionFn => {
      for (let i = 1; i <= 20; i++) {
        if (conditionFn()) {
          return;
        }
        await new Promise(resolve => setTimeout(resolve, i * 50));
      }
      throw new Error("Component not ready");
    };

    return {
      steps,
      onBeforeStart: () => {
        document.querySelector('[class^="section_contents"] > div > div').style.backgroundColor = "#0e69a0";
        // document.querySelector('[class^="section_header"][href*="/apidocs"]').style.backgroundColor = "#0c5582";
        if (className !== '_User' && className.indexOf('_') !== -1) {
          history.push(context.generatePath("browser/_User"));
        }
        post(`/tutorial`, { databaseBrowser: true });

        // Updates the current logged user so that the tutorial won't be played
        // again when the user switches to another page
        user.playDatabaseBrowserTutorial = false;
        AccountManager.setCurrentUser({ user });
      },
      onBeforeChange: function(targetElement) {
        const introItems = this._introItems;

        // Fires event if it's not a forced transition
        if (!this._forcedStep && typeof back4AppNavigation === 'object' && typeof back4AppNavigation.onDatabaseBrowserTourStep === 'function') {
          back4AppNavigation.onDatabaseBrowserTourStep(introItems[this._currentStep].eventId);
        } else {
          this._forcedStep = false;
        }
        switch(this._currentStep) {
          case 0:
          case 1:
            let nextButton = getNextButton();
            if (nextButton) {
              nextButton.innerHTML = "Next";
            }
            break;
          case 2:
            const stepElement = document.querySelector('.introjs-helperNumberLayer');
            stepElement.style.marginLeft = '20px';
            nextButton = getNextButton();
            nextButton.innerHTML = "Run";
            break;
          case 3:
            if (!getCustomVehicleClassLink() && !unexpectedErrorThrown) {
              schema.dispatch(ActionTypes.CREATE_CLASS, {
                className: 'B4aVehicle',
                fields: {
                  name: { type: 'String' },
                  price: { type: 'Number' },
                  color: { type: 'String' },
                }
              }).then(() => {
                return context.currentApp.apiRequest('POST', '/classes/B4aVehicle', { name: 'Corolla', price: 19499, color: 'black' }, { useMasterKey: true });
              }).then(() => {
                introItems[3].element = getCustomVehicleClassLink();
                this.nextStep();
              }).catch(e => {
                if (!unexpectedErrorThrown) {
                  console.log(introItems);
                  introItems.splice(3, 2);
                  for (let i=3; i<introItems.length; i++) {
                    introItems[i].step -= 2;
                  }
                  unexpectedErrorThrown = true;
                }
                console.error(e);
                this.nextStep();
              });
              return false;
            }
            nextButton = getNextButton();
            nextButton.innerHTML = 'Next';

            const numberLayer = document.querySelector('.introjs-helperNumberLayer');
            numberLayer.style.marginLeft = 0;
            if (!unexpectedErrorThrown) {
              history.push(context.generatePath('browser/B4aVehicle'));
            }
            break;
          case 4:
            if (!unexpectedErrorThrown) {
              this._introItems[4].element = document.querySelector('[class^=browser] [class^=tableRow] > :nth-child(2) span');
            }
            break;
          case 5:
            if(unexpectedErrorThrown) {
              targetElement.style.backgroundColor = 'inherit';
            }
            break;
          case 6:
            let nextBtn = getNextButton();
            let prevBtn = getPrevButton();
            // hide prev & next buttons
            nextBtn.style.display = 'none';
            prevBtn.style.display = 'none';
            // move Done button to right
            prevBtn.parentElement.style.justifyContent = 'end';
            targetElement.style.backgroundColor = 'inherit';
            break;
        }
      },
      onAfterChange: function(targetElement) {
        switch(this._currentStep) {
          case 0:
            if (this._introItems.length === 1) {
              // Disables the Prev button
              document.querySelector('.introjs-button.introjs-prevbutton').classList.add('introjs-disabled');
              targetElement.style.backgroundColor = 'inherit';
            }
            break;
          case 3:
            if (!unexpectedErrorThrown) {
              if (!document.querySelector('[class^=browser] [class^=tableRow] > :nth-child(2) span')){
                // next row has not rendered yet
                let nextButton = getNextButton();
                nextButton.innerHTML = `<div class="${styles.spinnerBorder}" role="status"></div>`;
                nextButton.classList.add('introjs-disabled', styles.tourLoadingBtn);
                getNextComponentReadyPromise(() => document.querySelector('[class^=browser] [class^=tableRow] > :nth-child(2) span'))
                  .then(() => {
                    nextButton.innerHTML = 'Next';
                    nextButton.classList.remove('introjs-disabled', styles.tourLoadingBtn);
                  })
              }
              targetElement.style.backgroundColor = "#0e69a0";
            }
            break;
        }
      },
      onBeforeExit: function() {
        // If is exiting before the last step, avoid exit and shows the last step
        if (this._currentStep < this._introItems.length - 1) {
          this._forcedStep = true;
          const elementsRemoved = this._introItems.length - 1;
          this._introItems.splice(0, elementsRemoved);
          for (let i=0; i<this._introItems.length; i++) {
            this._introItems[i].step -= elementsRemoved;
          }
          this.goToStep(this._introItems.length);
          return false;
        }
      },
      onExit: () => {
        this.setState({ showTour: false });
      }
    };
  }

  async prefetchData(props, context) {
    const filters = this.extractFiltersFromQuery(props);
    const { className, entityId, relationName } = props.params;
    const isRelationRoute = entityId && relationName;
    let relation = this.state.relation;
    if (isRelationRoute && !relation) {
      const parentObjectQuery = new Parse.Query(className);
      const { useMasterKey } = this.state;
      const parent = await parentObjectQuery.get(entityId, { useMasterKey });
      relation = parent.relation(relationName);
    }
    await this.setState({
      data: null,
      newObject: null,
      lastMax: -1,
      ordering: ColumnPreferences.getColumnSort(
        false,
        context.currentApp.applicationId,
        className,
      ),
      selection: {},
      relation: isRelationRoute ? relation : null,
    });
    if (isRelationRoute) {
      this.fetchRelation(relation, filters);
    } else if (className) {
      this.fetchData(className, filters);
      this.fetchClassIndexes(className);
    }
  }

  extractFiltersFromQuery(props) {
    let filters = new List();
    //TODO: url limit issues ( we may want to check for url limit), unlikely but possible to run into
    if (!props || !props.location || !props.location.search) {
      return filters;
    }
    const query = queryString.parse(props.location.search);
    if (query.filters) {
      const queryFilters = JSON.parse(query.filters);
      queryFilters.forEach((filter) => filters = filters.push(new Map(filter)));
    }
    return filters;
  }

  redirectToFirstClass(classList) {
    if (!classList.isEmpty()) {
      classList = Object.keys(classList.toObject());
      let classes = classList.filter(className => className !== '_Role' && className !== '_User' && className !== '_Installation');
      classes.sort((a, b) => {
        if (a[0] === '_' && b[0] !== '_') {
          return -1;
        }
        if (b[0] === '_' && a[0] !== '_') {
          return 1;
        }
        return a.toUpperCase() < b.toUpperCase() ? -1 : 1;
      });
      if (classes[0]) {
        history.replace(this.context.generatePath(`browser/${classes[0]}`));
      } else {
        if (classList.indexOf('_User') !== -1) {
          history.replace(this.context.generatePath('browser/_User'));
        } else {
          history.replace(this.context.generatePath(`browser/${classList[0]}`));
        }
      }
    }
  }

  showCreateClass() {
    if (!this.props.schema.data.get('classes')) {
      return;
    }
    this.setState({ showCreateClassDialog: true });
  }

  showAddColumn() {
    this.setState({ showAddColumnDialog: true });
  }

  showRemoveColumn() {
    this.setState({ showRemoveColumnDialog: true });
  }

  showDeleteRows(rows) {
    this.setState({ rowsToDelete: rows });
  }

  showColumnDelete(name) {
    this.setState({ columnToDelete: name });
  }

  showDropClass() {
    this.setState({ showDropClassDialog: true });
  }

  showImport() {
    this.setState({ showImportDialog: true });
  }

  showImportRelation() {
    this.setState({ showImportRelationDialog: true });
  }

  showExport() {
    this.setState({ showExportDialog: true });
  }

  async login(username, password) {
    if (Parse.User.current()) {
      await Parse.User.logOut();
    }

    const currentUser = await Parse.User.logIn(username, password);
    this.setState({ currentUser: currentUser, useMasterKey: false }, () => this.refresh());
  }

  async logout() {
    await Parse.User.logOut();
    this.setState({ currentUser: null, useMasterKey: true }, () => this.refresh());
  }

  toggleMasterKeyUsage() {
    const { useMasterKey } = this.state;
    this.setState({ useMasterKey: !useMasterKey }, () => this.refresh());
  }

  createClass(className, isProtected) {
    let clp = isProtected ? protectedCLPs : defaultCLPS;
    if (semver.lte(this.context.currentApp.serverInfo.parseServerVersion, '3.1.1')) {
      clp = {};
    }
    this.props.schema.dispatch(ActionTypes.CREATE_CLASS, { className, clp }).then(() => {
      this.state.counts[className] = 0;
      history.push(this.context.generatePath('browser/' + className));
    }).then(() => {
      // Send track event
      back4AppNavigation && back4AppNavigation.createClassClickEvent()
    }).catch(error => {
      let errorDeletingNote = 'Internal server error'
      if (error.code === 403) errorDeletingNote = error.message;

      this.showNote(errorDeletingNote, true);
    }).finally(() => {
      this.setState({ showCreateClassDialog: false });
    });
  }

  dropClass(className) {
    this.props.schema.dispatch(ActionTypes.DROP_CLASS, { className }).then(() => {
      this.setState({showDropClassDialog: false });
      delete this.state.counts[className];
      history.push(this.context.generatePath('browser'));
    }, (error) => {
      let msg = typeof error === 'string' ? error : error.message;
      if (msg) {
        msg = msg[0].toUpperCase() + msg.substr(1);
      }

      if (error.code === 403) msg = error.message;
      this.setState({showDropClassDialog: false });

      this.showNote(msg, true);
    });
  }

  importClass(className, file) {
    return this.context.currentApp.importData(className, file)
      .then((res) => {
        return res;
      }, (error) => {
        console.log(error);
        return Promise.resolve({
          error: true,
          message: error.message
        });
      });
  }

  importRelation(className, relationName, file) {
    return this.context.currentApp.importRelationData(className, relationName, file)
      .then((res) => {
        return res;
      }, (error) => {
        console.log(error);
        return Promise.resolve({
          error: true,
          message: error.message
        });
      });
  }

  exportClass(className) {
    this.context.currentApp.exportClass(className).finally(() => {
      this.setState({ showExportDialog: false });
    });
  }

  newColumn(payload) {
    return this.props.schema.dispatch(ActionTypes.ADD_COLUMN, payload).catch(err => {
        let errorDeletingNote = 'Internal server error';
        if (err.code === 403) errorDeletingNote = err.message;

        this.showNote(errorDeletingNote, true);
      });
  }

  addColumn({ type, name, target, required, defaultValue }) {
    let payload = {
      className: this.props.params.className,
      columnType: type,
      name: name,
      targetClass: target,
      required,
      defaultValue
    };
    this.newColumn(payload).finally(() => {
      this.setState({ showAddColumnDialog: false, keepAddingCols: false });
    });
  }

  addColumnAndContinue({ type, name, target, required, defaultValue }) {
    let payload = {
      className: this.props.params.className,
      columnType: type,
      name: name,
      targetClass: target,
      required,
      defaultValue
    };
    this.newColumn(payload).finally(() => {
      this.setState({ showAddColumnDialog: false, keepAddingCols: false });
      this.setState({ showAddColumnDialog: true, keepAddingCols: true });
    });
  }

  addRow() {
    if (!this.state.newObject) {
      const relation = this.state.relation;
      this.setState({
        newObject: (relation ?
          new Parse.Object(relation.targetClassName)
        : new Parse.Object(this.props.params.className) ),
      });
    }
  }

  addEditCloneRows(cloneRows) {
    this.setState({
      editCloneRows: cloneRows
    });
  }

  abortEditCloneRows(){
    if (this.state.editCloneRows) {
      this.setState({
        editCloneRows: null
      });
    }
  }

  abortAddRow(){
    if(this.state.newObject){
      this.setState({
        newObject: null
      });
    }
    if (this.state.markRequiredFieldRow !== 0) {
      this.setState({
        markRequiredFieldRow: 0
      });
    }
  }

  saveNewRow(){
    const { useMasterKey } = this.state;
    const obj = this.state.newObject;
    if (!obj) {
      return;
    }

    // check if required fields are missing
    const className = this.props.params.className;
    let requiredCols = [];
    if (className) {
      let classColumns = this.props.schema.data.get('classes').get(className);
      classColumns.forEach(({ required }, name) => {
          if (name === 'objectId' || this.state.isUnique && name !== this.state.uniqueField) {
            return;
          }
          if (!!required) {
            requiredCols.push(name);
          }
          if (className === '_User' && (name === 'username' || name === 'password')) {
            if (!obj.get('authData')) {
              requiredCols.push(name);
            }
          }
          if (className === '_Role' && (name === 'name' || name === 'ACL')) {
            requiredCols.push(name);
          }
        });
    }
    if (requiredCols.length) {
      for (let idx = 0; idx < requiredCols.length; idx++) {
        const name = requiredCols[idx];
        if (!obj.get(name)) {
          this.showNote("Please enter all required fields", true);
          this.setState({
            markRequiredFieldRow: -1
          });
          return;
        }
      }
    }
    if (this.state.markRequiredFieldRow) {
      this.setState({
        markRequiredFieldRow: 0
      });
    }
    obj.save(null, { useMasterKey }).then(
      objectSaved => {
        let msg = objectSaved.className + ' with id \'' + objectSaved.id + '\' created';
        this.showNote(msg, false);

        const state = { data: this.state.data };
        const relation = this.state.relation;
        if (relation) {
          const parent = relation.parent;
          const parentRelation = parent.relation(relation.key);
          parentRelation.add(obj);
          const targetClassName = relation.targetClassName;
          parent.save(null, { useMasterKey }).then(
            () => {
              this.setState({
                newObject: null,
                data: [obj, ...this.state.data],
                relationCount: this.state.relationCount + 1,
                counts: {
                  ...this.state.counts,
                  [targetClassName]: this.state.counts[targetClassName] + 1
                }
              });
            },
            error => {
              let msg = typeof error === "string" ? error : error.message;
              if (msg) {
                msg = msg[0].toUpperCase() + msg.substr(1);
              }
              obj.set(attr, prev);
              this.setState({ data: this.state.data });
              this.showNote(msg, true);
            }
          );
        } else {
          state.newObject = null;
          if (this.props.params.className === obj.className) {
            this.state.data.unshift(obj);
          }
          this.state.counts[obj.className] += 1;
        }

        this.setState(state);
      },
      error => {
        let msg = typeof error === "string" ? error : error.message;
        if (msg) {
          msg = msg[0].toUpperCase() + msg.substr(1);
        }
        this.showNote(msg, true);
      }
    );
  }

  saveEditCloneRow(rowIndex) {
    let obj;
    if (rowIndex < -1) {
      obj = this.state.editCloneRows[
        rowIndex + (this.state.editCloneRows.length + 1)
      ];
    }
    if (!obj) {
      return;
    }

    // check if required fields are missing
    const className = this.props.params.className;
    let requiredCols = [];
    if (className) {
      let classColumns = this.props.schema.data.get('classes').get(className);
      classColumns.forEach(({ required }, name) => {
          if (name === 'objectId' || this.state.isUnique && name !== this.state.uniqueField) {
            return;
          }
          if (!!required) {
            requiredCols.push(name);
          }
          if (className === '_User' && (name === 'username' || name === 'password')) {
            if (!obj.get('authData')) {
              requiredCols.push(name);
            }
          }
          if (className === '_Role' && (name === 'name' || name === 'ACL')) {
            requiredCols.push(name);
          }
        });
    }
    if (requiredCols.length) {
      for (let idx = 0; idx < requiredCols.length; idx++) {
        const name = requiredCols[idx];
        if (!obj.get(name)) {
          this.showNote("Please enter all required fields", true);
          this.setState({
            markRequiredFieldRow: rowIndex
          });
          return;
        }
      }
    }
    if (this.state.markRequiredFieldRow) {
      this.setState({
        markRequiredFieldRow: 0
      });
    }

    obj.save(null, { useMasterKey: true }).then((objectSaved) => {
      let msg = objectSaved.className + ' with id \'' + objectSaved.id + '\' ' + 'created';
      this.showNote(msg, false);

      const state = { data: this.state.data, editCloneRows: this.state.editCloneRows };
      state.editCloneRows = state.editCloneRows.filter(
        cloneObj => cloneObj._localId !== obj._localId
      );
      if (state.editCloneRows.length === 0) state.editCloneRows = null;
      if (this.props.params.className === obj.className) {
        this.state.data.unshift(obj);
      }
      this.state.counts[obj.className] += 1;
      this.setState(state);
    }, (error) => {
      let msg = typeof error === 'string' ? error : error.message;
      if (msg) {
        msg = msg[0].toUpperCase() + msg.substr(1);
      }

      this.showNote(msg, true);
    });
  }

  abortEditCloneRow(rowIndex) {
    let obj;
    if (rowIndex < -1) {
      obj = this.state.editCloneRows[
        rowIndex + (this.state.editCloneRows.length + 1)
      ];
    }
    if (!obj) {
      return;
    }
    const state = { editCloneRows: this.state.editCloneRows };
    state.editCloneRows = state.editCloneRows.filter(
      cloneObj => cloneObj._localId !== obj._localId
    );
    if (state.editCloneRows.length === 0) state.editCloneRows = null;
    this.setState(state);
  }

  addRowWithModal() {
    this.addRow();
    this.selectRow(undefined, true);
    this.showEditRowDialog();
  }

  cancelPendingEditRows() {
    this.setState({
      editCloneRows: null
    });
  }

  addEditCloneRows(cloneRows) {
    this.setState({
      editCloneRows: cloneRows
    });
  }

  removeColumn(name, selectedColumn = false) {
    let payload = {
      className: this.props.params.className,
      name: name
    };
    this.props.schema.dispatch(ActionTypes.DROP_COLUMN, payload).catch(error => {
      let errorDeletingNote = 'Internal server error'
      if (error.code === 403) errorDeletingNote = error.message;

      this.showNote(errorDeletingNote, true);
      if (selectedColumn)
        this.setState({ columnToDelete: null });
      else
        this.setState({ showRemoveColumnDialog: false });

    }).finally(() => {
      let state = selectedColumn ? { columnToDelete : null } : {showRemoveColumnDialog: false };
      if (this.state.ordering === name || this.state.ordering === '-' + name) {
        state.ordering = '-createdAt';
      }
      this.setState(state);
    });
  }

  async handleFetchedSchema() {
    const counts = this.state.counts;
    if (this.state.computingClassCounts === false) {
      this.setState({ computingClassCounts: true });
      for (const parseClass of this.props.schema.data.get('classes')) {
        const [className] = parseClass;
        counts[className] = await this.context.currentApp.getClassCount(className);
      }

      this.setState({
        clp: this.props.schema.data.get('CLPs').toJS(),
        counts,
        computingClassCounts: false
      });
    }
  }

  async refresh() {
    const relation = this.state.relation;
    const prevFilters = this.state.filters || new List();
    const initialState = {
      data: null,
      newObject: null,
      lastMax: -1,
      selection: {},
      relation: null,
      editCloneRows: null
    };
    if (relation) {
      await this.setState(initialState);
      await this.setRelation(relation, prevFilters);
    } else {
      await this.setState({
        ...initialState,
        relation: null,
      });
      await this.fetchData(this.props.params.className, prevFilters);
    }
  }

  async fetchParseData(source, filters) {
    const { useMasterKey } = this.state;
    const query = queryFromFilters(source, filters);
    const sortDir = this.state.ordering[0] === '-' ? '-' : '+';
    const field = this.state.ordering.substr(sortDir === '-' ? 1 : 0)

    if (sortDir === '-') {
      query.descending(field)
    } else {
      query.ascending(field)
    }
    if (field !== 'objectId') {
      if (sortDir === '-') {
        query.addDescending('objectId')
      } else {
        query.addAscending('objectId')
      }
    }

    const classes = await Parse.Schema.all();
    const schema = classes.find( c => c.className === this.props.params.className);

    const fieldKeys = Object.keys(schema.fields)
    for ( let i = 0; i < fieldKeys.length; i++ ) {
      const schemaKey = fieldKeys[i];
      const schVal = schema.fields[schemaKey];
      if ( schVal.type === 'Pointer' ) {
        const defaultPointerKey = await localStorage.getItem(schVal.targetClass) || 'objectId';
        if ( defaultPointerKey !== 'objectId' ) {
          query.include(schemaKey);
          query.select(schemaKey + '.' + defaultPointerKey);
        }
      }
    }

    query.limit(MAX_ROWS_FETCHED);
    semver.gt(this.context.currentApp.serverInfo.parseServerVersion, '3.6.0') &&
      this.excludeFields(query, source);

    let promise = query.find({ useMasterKey });
    let isUnique = false;
    let uniqueField = null;
    filters.forEach(async (filter) => {
      if (filter.get('constraint') == 'unique') {
        const field = filter.get('field');
        promise = query.distinct(field);
        isUnique = true;
        uniqueField = field;
      }
    });
    await this.setState({ isUnique, uniqueField });

    const data = await promise;
    return data;
  }

  excludeFields(query, className) {
    let columns = ColumnPreferences.getPreferences(this.context.currentApp.applicationId, className);
    if (columns) {
      columns = columns.filter(clmn => !clmn.visible).map(clmn => clmn.name);
      for (let columnsKey in columns) {
        query.exclude(columns[columnsKey]);
      }
      ColumnPreferences.updateCachedColumns(this.context.currentApp.applicationId, className);
    }
  }

  async fetchParseDataCount(source, filters) {
    const query = queryFromFilters(source, filters);
    const { useMasterKey } = this.state;
    const count = await query.count({ useMasterKey });
    return count;
  }

  async fetchData(source, filters = new List()) {
    try {
      const data = await this.fetchParseData(source, filters);
      var filteredCounts = { ...this.state.filteredCounts };
      if (filters.size > 0) {
        if (this.state.isUnique) {
          filteredCounts[source] = data.length;
        } else {
          filteredCounts[source] = await this.fetchParseDataCount(source, filters);
        }
      } else {
        delete filteredCounts[source];
      }
      this.setState({ data: data, filters, lastMax: MAX_ROWS_FETCHED , filteredCounts: filteredCounts});
    } catch(err) {
      this.setState({ data: [], filters, err });
    }
  }

  async fetchRelation(relation, filters = new List()) {
    const data = await this.fetchParseData(relation, filters);
    const relationCount = await this.fetchRelationCount(relation);
    await this.setState({
      relation,
      relationCount,
      selection: {},
      data,
      filters,
      lastMax: MAX_ROWS_FETCHED,
    });
  }

  async fetchRelationCount(relation) {
    return await this.context.currentApp.getRelationCount(relation);
  }

  async fetchClassIndexes(className){
    try {
      const data = await this.context.currentApp.getIndexes(className);
      if(data){
        this.setState({
          uniqueClassFields: data
            .filter(idxObj => idxObj.unique)
            .map(obj => Object.keys(JSON.parse(obj.index)))
            .flat()
        });
      }
    } catch (error) {
      this.setState({
        uniqueClassFields: []
      });
    }
  }

  fetchNextPage() {
    if (!this.state.data || this.state.isUnique) {
      return null;
    }
    let className = this.props.params.className;
    let source = this.state.relation || className;
    let query = queryFromFilters(source, this.state.filters);
    if (this.state.ordering !== '-createdAt') {
      // Construct complex pagination query
      let equalityQuery = queryFromFilters(source, this.state.filters);
      let field = this.state.ordering;
      let ascending = true;
      let comp = this.state.data[this.state.data.length - 1].get(field);
      if (field === 'objectId' || field === '-objectId') {
        comp = this.state.data[this.state.data.length - 1].id;
      }
      if (field[0] === '-') {
        field = field.substr(1);
        query.lessThan(field, comp);
        ascending = false;
      } else {
        query.greaterThan(field, comp);
      }
      if (field === 'createdAt') {
        equalityQuery.greaterThan('createdAt', this.state.data[this.state.data.length - 1].get('createdAt'));
      } else {
        equalityQuery.lessThan('createdAt', this.state.data[this.state.data.length - 1].get('createdAt'));
        equalityQuery.equalTo(field, comp);
      }
      query = Parse.Query.or(query, equalityQuery);
      if (ascending) {
        query.ascending(this.state.ordering);
      } else {
        query.descending(this.state.ordering.substr(1));
      }
    } else {
      query.lessThan('createdAt', this.state.data[this.state.data.length - 1].get('createdAt'));
      query.addDescending('createdAt');
    }
    query.limit(MAX_ROWS_FETCHED);
    semver.gt(this.context.currentApp.serverInfo.parseServerVersion, '3.6.0') &&
      this.excludeFields(query, source);

    const { useMasterKey } = this.state;
    query.find({ useMasterKey }).then((nextPage) => {
      if (className === this.props.params.className) {
        this.setState((state) => ({
          data: state.data.concat(nextPage)
        }));
      }
    });
    this.setState({ lastMax: this.state.lastMax + MAX_ROWS_FETCHED });
  }


  updateFilters(filters) {
    const relation = this.state.relation;
    if (relation) {
      this.setRelation(relation, filters);
    } else {
      const source = this.props.params.className;
      const _filters = JSON.stringify(filters.toJSON());
      const url = `browser/${source}${(filters.size === 0 ? '' : `?filters=${(encodeURIComponent(_filters))}`)}`;
      // filters param change is making the fetch call
      history.push(this.context.generatePath(url));
    }
  }

  updateOrdering(ordering) {
    let source = this.state.relation || this.props.params.className;
    this.setState({
      ordering: ordering,
      selection: {}
    }, () => this.fetchData(source, this.state.filters));
    ColumnPreferences.getColumnSort(
      ordering,
      this.context.currentApp.applicationId,
      this.props.params.className
    );
  }

  getRelationURL() {
    const relation = this.state.relation;
    const className = this.props.params.className;
    const entityId = relation.parent.id;
    const relationName = relation.key;
    return this.context.generatePath(`browser/${className}/${entityId}/${relationName}`);
  }

  setRelation(relation, filters) {
    this.setState({
      relation: relation,
      data: null,
    }, () => {
      let filterQueryString;
      if (filters && filters.size) {
        filterQueryString = encodeURIComponent(JSON.stringify(filters.toJSON()));
      }
      const url = `${this.getRelationURL()}${filterQueryString ? `?filters=${filterQueryString}` : ''}`;
      history.push(url);
    });
  }

  handlePointerCmdClick({ className, id, field = 'objectId' }) {
    let filters = JSON.stringify([{
      field,
      constraint: 'eq',
      compareTo: id
    }]);
    window.open(this.context.generatePath(`browser/${className}?filters=${encodeURIComponent(filters)}`),'_blank');
  }

  handlePointerClick({ className, id, field = 'objectId' }) {
    let filters = JSON.stringify([{
        field,
        constraint: 'eq',
        compareTo: id
    }]);
    history.push(this.context.generatePath(`browser/${className}?filters=${encodeURIComponent(filters)}`));
  }

  handlePointerCmdClick({ className, id, field = 'objectId' }) {
    let filters = JSON.stringify([{
      field,
      constraint: 'eq',
      compareTo: id
    }]);
    window.open(this.context.generatePath(`browser/${className}?filters=${encodeURIComponent(filters)}`),'_blank');
  }

  handleCLPChange(clp) {
    const { serverInfo } = this.context.currentApp;
    if (typeof serverInfo.parseServerVersion !== 'undefined') {
      if (serverInfo.parseServerVersion < '2.6') delete clp.count;
      if (serverInfo.parseServerVersion < '3.7') delete clp.protectedFields;
    }
    let p = this.props.schema.dispatch(ActionTypes.SET_CLP, {
      className: this.props.params.className,
      clp,
    });
    p.then(() => this.handleFetchedSchema());
    return p;
  }

  getLastCreatedObject(rows) {
    return rows.filter(row => row._objCount === rows.length - 1).pop()
  }

  updateRow(row, attr, value) {
    let isNewObject = row === -1;
    let isEditCloneObj = row < -1;
    let obj = isNewObject ? this.state.newObject : this.state.data[row];
    if (!obj && isNewObject) {
      obj = this.getLastCreatedObject(this.state.data)
      isNewObject = false
    }
    if(isEditCloneObj){
      obj = this.state.editCloneRows[row + (this.state.editCloneRows.length + 1)];
    }
    if (!obj) {
      return;
    }
    const prev = obj.get(attr);
    if (value === prev) {
      return;
    }
    if (value === undefined) {
      obj.unset(attr);
    } else {
      obj.set(attr, value);
    }

    if (isNewObject) {
      this.setState({
        isNewObject: obj
      });
      return;
    }
    if (isEditCloneObj) {
      const editObjIndex = row + (this.state.editCloneRows.length + 1);
      let cloneRows = [...this.state.editCloneRows];
      cloneRows.splice(editObjIndex, 1, obj);
      this.setState({
        editCloneRows: cloneRows
      });
      return;
    }

    const { useMasterKey } = this.state;
    obj.save(null, { useMasterKey }).then((objectSaved) => {
      let msg = objectSaved.className + ' with id \'' + objectSaved.id + '\' updated';
      this.showNote(msg, false);

      const state = { data: this.state.data, editCloneRows: this.state.editCloneRows };

      if (isNewObject) {
        const relation = this.state.relation;
        if (relation) {
          const parent = relation.parent;
          const parentRelation = parent.relation(relation.key);
          parentRelation.add(obj);
          const targetClassName = relation.targetClassName;
          parent.save(null, { useMasterKey: true }).then(() => {
            this.setState({
              newObject: null,
              data: [
                obj,
                ...this.state.data,
              ],
              relationCount: this.state.relationCount + 1,
              counts: {
                ...this.state.counts,
                [targetClassName]: this.state.counts[targetClassName] + 1,
              },
            });
          }, (error) => {
            let msg = typeof error === 'string' ? error : error.message;
            if (msg) {
              msg = msg[0].toUpperCase() + msg.substr(1);
            }
            obj.set(attr, prev);
            this.setState({ data: this.state.data });
            this.showNote(msg, true);
          });
        } else {
          state.newObject = null;
          if (this.props.params.className === obj.className) {
            this.state.data.unshift(obj);
          }
          this.state.counts[obj.className] += 1;
        }
      }
      if (isEditCloneObj) {
        state.editCloneRows = state.editCloneRows.filter(
          cloneObj => cloneObj._localId !== obj._localId
        );
        if (state.editCloneRows.length === 0) state.editCloneRows = null;
        if (this.props.params.className === obj.className) {
          this.state.data.unshift(obj);
        }
        this.state.counts[obj.className] += 1;
      }
      this.setState(state);
    }, (error) => {
      let msg = typeof error === 'string' ? error : error.message;
      if (msg) {
        msg = msg[0].toUpperCase() + msg.substr(1);
      }
      if (!isNewObject && !isEditCloneObj) {
        obj.set(attr, prev);
        this.setState({ data: this.state.data });
      }

      this.showNote(msg, true);
    });
  }

  deleteRows(rows) {
    this.setState({ rowsToDelete: null, selection: {} });
    let className = this.props.params.className;
    if (!this.state.relation && rows['*']) {
      this.context.currentApp.clearCollection(className).then(() => {
        if (this.props.params.className === className) {
          this.state.counts[className] = 0;
          this.setState({
            data: [],
            lastMax: MAX_ROWS_FETCHED,
            selection: {},
          });
        }
      });
    } else {
      let indexes = [];
      let toDelete = [];
      let seeking = Object.keys(rows).length;
      for (let i = 0; i < this.state.data.length && indexes.length < seeking; i++) {
        let obj = this.state.data[i];
        if (!obj || !obj.id) {
          continue;
        }
        if (rows[obj.id]) {
          indexes.push(i);
          toDelete.push(this.state.data[i]);
        }
      }

      const toDeleteObjectIds = [];
      toDelete.forEach((obj) => { toDeleteObjectIds.push(obj.id); });

      const { useMasterKey } = this.state;
      let relation = this.state.relation;
      if (relation && toDelete.length) {
        relation.remove(toDelete);
        relation.parent.save(null, { useMasterKey }).then(() => {
          if (this.state.relation === relation) {
            for (let i = 0; i < indexes.length; i++) {
              this.state.data.splice(indexes[i] - i, 1);
            }
            this.setState({
              relationCount: this.state.relationCount - toDelete.length,
            });
          }
        });
      } else if (toDelete.length) {
        Parse.Object.destroyAll(toDelete, { useMasterKey }).then(() => {
          let deletedNote;

          if (toDeleteObjectIds.length == 1) {
            deletedNote = className + ' with id \'' + toDeleteObjectIds[0] + '\' deleted';
          } else {
            deletedNote = toDeleteObjectIds.length + ' ' + className + ' objects deleted';
          }

          this.showNote(deletedNote, false);

          if (this.props.params.className === className) {
            for (let i = 0; i < indexes.length; i++) {
              this.state.data.splice(indexes[i] - i, 1);
            }
            this.state.counts[className] -= indexes.length;

            // If after deletion, the remaining elements on the table is lesser than the maximum allowed elements
            // we fetch more data to fill the table
            if (this.state.data.length < MAX_ROWS_FETCHED) {
              this.prefetchData(this.props, this.context);
            } else {
              this.forceUpdate();
            }
          }
        }, (error) => {
          let errorDeletingNote = null;

          if (error.code === Parse.Error.AGGREGATE_ERROR) {
            if (error.errors.length == 1) {
              errorDeletingNote = 'Error deleting ' + className + ' with id \'' + error.errors[0].object.id + '\'';
            } else if (error.errors.length < toDeleteObjectIds.length) {
              errorDeletingNote = 'Error deleting ' + error.errors.length + ' out of ' + toDeleteObjectIds.length + ' ' + className + ' objects';
            } else {
              errorDeletingNote = 'Error deleting all ' + error.errors.length + ' ' + className + ' objects';
            }
          } else {
            if (toDeleteObjectIds.length == 1) {
              errorDeletingNote = 'Error deleting ' + className + ' with id \'' + toDeleteObjectIds[0] + '\'';
            } else {
              errorDeletingNote = 'Error deleting ' + toDeleteObjectIds.length + ' ' + className + ' objects';
            }
          }

          if (error.code === 403) errorDeletingNote = error.message;


          this.showNote(errorDeletingNote, true);
        });
      }
    }
  }

  selectRow(id, checked) {
    this.setState(({ selection }) => {
      if (checked) {
        selection[id] = true;
      } else {
        delete selection[id];
      }
      return { selection };
    });
  }

  hasExtras() {
    return !!(
      this.state.showCreateClassDialog ||
      this.state.showAddColumnDialog ||
      this.state.showRemoveColumnDialog ||
      this.state.showDropClassDialog ||
      this.state.showImportDialog ||
      this.state.showImportRelationDialog ||
      this.state.showExportDialog ||
      this.state.rowsToDelete ||
      this.state.showAttachRowsDialog ||
      this.state.showAttachSelectedRowsDialog ||
      this.state.showCloneSelectedRowsDialog ||
      this.state.showEditRowDialog ||
      this.state.showPermissionsDialog ||
      this.state.showExportSelectedRowsDialog
    );
  }

  showAttachRowsDialog() {
    this.setState({
      showAttachRowsDialog: true,
    });
  }

  cancelAttachRows() {
    this.setState({
      showAttachRowsDialog: false,
    });
  }

  async confirmAttachRows(objectIds) {
    if (!objectIds || !objectIds.length) {
      throw 'No objectId passed';
    }
    const { useMasterKey } = this.state;
    const relation = this.state.relation;
    const query = new Parse.Query(relation.targetClassName);
    const parent = relation.parent;
    query.containedIn('objectId', objectIds);
    let objects = await query.find({ useMasterKey });
    const missedObjectsCount = objectIds.length - objects.length;
    if (missedObjectsCount) {
      const missedObjects = [];
      objectIds.forEach((objectId) => {
        const object = objects.find(x => x.id === objectId);
        if (!object) {
          missedObjects.push(objectId);
        }
      });
      const errorSummary = `${missedObjectsCount === 1 ? 'The object is' : `${missedObjectsCount} Objects are`} not retrieved:`;
      throw `${errorSummary} ${JSON.stringify(missedObjects)}`;
    }
    parent.relation(relation.key).add(objects);
    await parent.save(null, { useMasterKey });
    // remove duplication
    this.state.data.forEach(origin => objects = objects.filter(object => object.id !== origin.id));
    this.setState({
      data: [
        ...objects,
        ...this.state.data,
      ],
      relationCount: this.state.relationCount + objects.length,
      showAttachRowsDialog: false,
    });
  }

  showAttachSelectedRowsDialog() {
    this.setState({
      showAttachSelectedRowsDialog: true,
    });
  }

  cancelAttachSelectedRows() {
    this.setState({
      showAttachSelectedRowsDialog: false,
    });
  }

  async confirmAttachSelectedRows(className, targetObjectId, relationName, objectIds, targetClassName) {
    const { useMasterKey } = this.state;
    const parentQuery = new Parse.Query(className);
    const parent = await parentQuery.get(targetObjectId, { useMasterKey });
    const query = new Parse.Query(targetClassName || this.props.params.className);
    query.containedIn('objectId', objectIds);
    const objects = await query.find({ useMasterKey });
    parent.relation(relationName).add(objects);
    await parent.save(null, { useMasterKey });
    this.setState({
      selection: {},
    });
  }

  showCloneSelectedRowsDialog() {
    this.setState({
      showCloneSelectedRowsDialog: true,
    });
  }

  cancelCloneSelectedRows() {
    this.setState({
      showCloneSelectedRowsDialog: false,
    });
  }

  async confirmCloneSelectedRows() {
    const { useMasterKey } = this.state;
    const objectIds = [];
    for (const objectId in this.state.selection) {
      objectIds.push(objectId);
    }
    const className = this.props.params.className;
    const query = new Parse.Query(className);
    query.containedIn('objectId', objectIds);
    const objects = await query.find({ useMasterKey });
    const toClone = [];
    for (const object of objects) {
      let clonedObj = object.clone();
      if (className === '_User') {
        clonedObj.set('username', undefined);
        clonedObj.set('authData', undefined);
      }
      toClone.push(clonedObj);
    }
    try {
      await Parse.Object.saveAll(toClone, { useMasterKey });
      this.setState({
        selection: {},
        data: [...toClone, ...this.state.data],
        showCloneSelectedRowsDialog: false,
        counts: {
          ...this.state.counts,
          [className]: this.state.counts[className] + toClone.length
        }
      });
    } catch (error) {
      //for duplicate, username missing or required field missing errors
      if (error.code === 137 || error.code === 200 || error.code === 142) {
        let failedSaveObj = [];
        let savedObjects = [];
        toClone.forEach(cloneObj => {
          cloneObj.dirty()
            ? failedSaveObj.push(cloneObj)
            : savedObjects.push(cloneObj);
        });
        if (savedObjects.length) {
          this.setState({
            data: [...savedObjects, ...this.state.data],
            counts: {
              ...this.state.counts,
              [className]: this.state.counts[className] + savedObjects.length
            }
          });
        }
        this.addEditCloneRows(failedSaveObj);
      }
      this.setState({
        showCloneSelectedRowsDialog: false
      });
      this.showNote(error.message, true);
    }
  }

  showExportSelectedRowsDialog(rows) {
    this.setState({
      rowsToExport: rows
    });
  }

  cancelExportSelectedRows() {
    this.setState({
      rowsToExport: null
    });
  }

  async confirmExportSelectedRows(rows) {
    this.setState({ rowsToExport: null });
    const className = this.props.params.className;
    const query = new Parse.Query(className);

    if (rows['*']) {
      // Export all
      query.limit(10000);
    } else {
      // Export selected
      const objectIds = [];
      for (const objectId in this.state.rowsToExport) {
        objectIds.push(objectId);
      }
      query.containedIn('objectId', objectIds);
    }

    const classColumns = this.getClassColumns(className, false);
    // create object with classColumns as property keys needed for ColumnPreferences.getOrder function
    const columnsObject = {};
    classColumns.forEach((column) => {
      columnsObject[column.name] = column;
    });
    // get ordered list of class columns
    const columns = ColumnPreferences.getOrder(
      columnsObject,
      this.context.currentApp.applicationId,
      className
    ).filter(column => column.visible);

    const objects = await query.find({ useMasterKey: true });
    let csvString = columns.map(column => column.name).join(',') + '\n';
    for (const object of objects) {
      const row = columns.map(column => {
        const type = columnsObject[column.name].type;
        if (column.name === 'objectId') {
          return object.id;
        } else if (type === 'Relation' || type === 'Pointer') {
          if (object.get(column.name)) {
            return  object.get(column.name).id
          } else {
            return ''
          }
        } else {
          let colValue;
          if (column.name === 'ACL') {
            colValue = object.getACL();
          } else {
            colValue = object.get(column.name);
          }
          // Stringify objects and arrays
          if (Object.prototype.toString.call(colValue) === '[object Object]' || Object.prototype.toString.call(colValue) === '[object Array]') {
            colValue = JSON.stringify(colValue);
          }
          if(typeof colValue === 'string') {
            if (colValue.includes('"')) {
              // Has quote in data, escape and quote
              // If the value contains both a quote and delimiter, adding quotes and escaping will take care of both scenarios
              colValue = colValue.split('"').join('""');
              return `"${colValue}"`;
            } else if (colValue.includes(',')) {
              // Has delimiter in data, surround with quote (which the value doesn't already contain)
              return `"${colValue}"`;
            } else {
              // No quote or delimiter, just include plainly
              return `${colValue}`;
            }
          } else if (colValue === undefined) {
            // Export as empty CSV field
            return '';
          } else {
            return `${colValue}`;
          }
        }
      }).join(',');
      csvString += row + '\n';
    }

    // Deliver to browser to download file
    const element = document.createElement('a');
    const file = new Blob([csvString], { type: 'text/csv' });
    element.href = URL.createObjectURL(file);
    element.download = `${className}.csv`;
    document.body.appendChild(element); // Required for this to work in FireFox
    element.click();
    document.body.removeChild(element);
  }

  getClassRelationColumns(className) {
    const currentClassName = this.props.params.className;
    return this.getClassColumns(className, false)
      .map(column => {
        if (column.type === 'Relation' && column.targetClass === currentClassName) {
          return column.name;
        }
      })
      .filter(column => column);
  }

  getClassColumns(className, onlyTouchable = true) {
    let columns = [];
    const classes = this.props.schema.data.get('classes');
    classes.get(className).forEach((field, name) => {
        columns.push({
          ...field,
          name,
        });
    });
    if (onlyTouchable) {
      let untouchable = DefaultColumns.All;
      if (className[0] === '_' && DefaultColumns[className]) {
        untouchable = untouchable.concat(DefaultColumns[className]);
      }
      columns = columns.filter((column) => untouchable.indexOf(column.name) === -1);
    }
    return columns;
  }

  renderSidebar() {
    let current = this.props.params.className || '';
    let classes = this.props.schema.data.get('classes');
    if (!classes) {
      return null;
    }
    let special = [];
    let categories = [];
    classes.forEach((value, key) => {
      let count = this.state.counts[key];
      if (count === undefined) {
        count = '';
      } else if (count >= 1000) {
        count = prettyNumber(count);
      }
      if (SpecialClasses[key]) {
        special.push({ name: SpecialClasses[key], id: key, count: count });
      } else {
        categories.push({ name: key, count: count });
      }
    });
    special.sort((a, b) => stringCompare(a.name, b.name));
    categories.sort((a, b) => stringCompare(a.name, b.name));
    return (
      <CategoryList
        current={current}
        linkPrefix={'browser/'}
        categories={special.concat(categories)} />
    );
  }

  showNote(message, isError) {
    if (!message) {
      return;
    }

    clearTimeout(this.noteTimeout);

    if (isError) {
      this.setState({ lastError: message, lastNote: null });
    } else {
      this.setState({ lastNote: message, lastError: null });
    }

    this.noteTimeout = setTimeout(() => {
      this.setState({ lastError: null, lastNote: null });
    }, 3500);
  }

  onClickIndexManager() {
    const { appId, className } = this.props.params
    history.push({
      pathname: `/apps/${appId}/index/${className}`,
      state: { showBackButton: true }
    })
  }

  onClickSecurity() {
    this.setState({
      openSecurityDialog: !this.state.openSecurityDialog
    });
  }

  showEditRowDialog(selectRow, objectId) {
    // objectId is optional param which is used for doubleClick event on objectId BrowserCell
    if (selectRow) {
      // remove all selected rows and select doubleClicked row
      this.setState({ selection: {} });
      this.selectRow(objectId, true);
    }
    this.setState({
      showEditRowDialog: true,
    });
  }

  closeEditRowDialog() {
    this.setState({
      showEditRowDialog: false,
    });
  }

  handleShowAcl(row, col){
    this.refs.dataBrowser.setEditing(true);
    this.refs.dataBrowser.setCurrent({ row, col });
  }

  showPointerKeyDialog() {
    this.setState({ showPointerKeyDialog: true });
  }

  async onChangeDefaultKey (name) {
    const className = this.props.params.className;
    if ( name ) {
      await localStorage.setItem(className, name);
    }
    this.setState({ showPointerKeyDialog: false });
  }

  // skips key controls handling when dialog is opened
  onDialogToggle(opened){
    this.setState({showPermissionsDialog: opened});
  }

  renderContent() {
    let browser = null;
    let className = this.props.params.className;
    if (this.state.relation) {
      className = this.state.relation.targetClassName;
    }
    let classes = this.props.schema.data.get('classes');
    if (classes) {
      if (classes.size === 0) {
        browser = (
          <div className={styles.empty}>
            <EmptyState
              title='You have no classes yet'
              description={'This is where you can view and edit your app\u2019s data'}
              icon='files-solid'
              cta='Create your first class'
              action={this.showCreateClass} />
          </div>
        );
      } else if (className && classes.get(className)) {

        let columns = {
          objectId: { type: 'String' }
        };
        if (this.state.isUnique) {
          columns = {};
        }
        classes.get(className).forEach(({ type, targetClass, required }, name) => {
          if (name === 'objectId' || this.state.isUnique && name !== this.state.uniqueField) {
            return;
          }
          const info = { type, required: !!required };
          if (className === '_User' && (name === 'username' || name === 'password' || name === 'authData')) {
            info.required = true;
          }
          if (className === '_Role' && (name === 'name' || name === 'ACL')) {
            info.required = true;
          }
          if (targetClass) {
            info.targetClass = targetClass;
          }
          columns[name] = info;
        });

        var count;
        if (this.state.relation) {
          count = this.state.relationCount;
        } else {
          if (className in this.state.filteredCounts) {
            count = this.state.filteredCounts[className];
          } else {
            count = this.state.counts[className];
          }
        }
        browser = (
          <DataBrowser
            ref="dataBrowser"
            isUnique={this.state.isUnique}
            uniqueField={this.state.uniqueField}
            count={count}
            perms={this.state.clp[className]}
            editCloneRows={this.state.editCloneRows}
            schema={this.props.schema}
            filters={this.state.filters}
            onFilterChange={this.updateFilters}
            onRemoveColumn={this.showRemoveColumn}
            onDeleteSelectedColumn={this.showColumnDelete}
            onDeleteRows={this.showDeleteRows}
            onDropClass={this.showDropClass}
            onExport={this.showExport}
            onImport={this.showImport}
            onImportRelation={this.showImportRelation}
            onChangeCLP={this.handleCLPChange}
            onRefresh={this.refresh}
            onAttachRows={this.showAttachRowsDialog}
            onAttachSelectedRows={this.showAttachSelectedRowsDialog}
            onCloneSelectedRows={this.showCloneSelectedRowsDialog}
            onImport={this.showImport}
            onEditSelectedRow={this.showEditRowDialog}
            onEditPermissions={this.onDialogToggle}
            onShowPointerKey={this.showPointerKeyDialog}
            onExportSelectedRows={this.showExportSelectedRowsDialog}

            onSaveNewRow={this.saveNewRow}
            onAbortAddRow={this.abortAddRow}
            onSaveEditCloneRow={this.saveEditCloneRow}
            onAbortEditCloneRow={this.abortEditCloneRow}
            onCancelPendingEditRows={this.cancelPendingEditRows}

            currentUser={this.state.currentUser}
            useMasterKey={this.state.useMasterKey}
            login={this.login}
            logout={this.logout}
            toggleMasterKeyUsage={this.toggleMasterKeyUsage}
            markRequiredFieldRow={this.state.markRequiredFieldRow}
            requiredColumnFields={this.state.requiredColumnFields}
            columns={columns}
            className={className}
            fetchNextPage={this.fetchNextPage}
            maxFetched={this.state.lastMax}
            selectRow={this.selectRow}
            selection={this.state.selection}
            data={this.state.data}
            ordering={this.state.ordering}
            newObject={this.state.newObject}
            editCloneRows={this.state.editCloneRows}
            relation={this.state.relation}
            disableKeyControls={this.hasExtras()}
            updateRow={this.updateRow}
            updateOrdering={this.updateOrdering}
            onPointerClick={this.handlePointerClick}
            onPointerCmdClick={this.handlePointerCmdClick}
            setRelation={this.setRelation}
            onAddColumn={this.showAddColumn}
            onAddRow={this.addRow}
            onAbortAddRow={this.abortAddRow}
            onAddRowWithModal={this.addRowWithModal}
            onAddClass={this.showCreateClass}
            onAbortEditCloneRows={this.abortEditCloneRows}
            err={this.state.err}
            showNote={this.showNote}
            onClickIndexManager={this.onClickIndexManager}
            onClickSecurity={this.onClickSecurity}
          />
        );
      }
    }
    let extras = null;
    if(this.state.showPointerKeyDialog){
      let currentColumns = this.getClassColumns(className).map(column => column.name);
      extras = (
        <PointerKeyDialog
          className={className}
          currentColumns={currentColumns}
          onCancel={() => this.setState({ showPointerKeyDialog: false })}
          onConfirm={this.onChangeDefaultKey} />
      );
    }
    if (this.state.showCreateClassDialog) {
      const { currentApp = {} } = this.context;
      extras = (
        <CreateClassDialog
          currentAppSlug={this.context.currentApp.slug}
          onAddColumn={this.showAddColumn}
          currentClasses={this.props.schema.data.get('classes').keySeq().toArray()}
          parseServerVersion={currentApp.serverInfo && currentApp.serverInfo.parseServerVersion}
          onCancel={() => this.setState({ showCreateClassDialog: false })}
          onConfirm={this.createClass} />
      );
    } else if (this.state.showAddColumnDialog) {
      const { currentApp = {} } = this.context;
      let currentColumns = [];
      classes.get(className).forEach((field, name) => {
        currentColumns.push(name);
      });
      extras = (
        <AddColumnDialog
          onAddColumn={this.showAddColumn}
          app={this.context.currentApp}
          currentColumns={currentColumns}
          classes={this.props.schema.data.get('classes').keySeq().toArray()}
          onCancel={() => this.setState({ showAddColumnDialog: false })}
          onConfirm={this.addColumn}
          onContinue={this.addColumnAndContinue}
          showNote={this.showNote}
          parseServerVersion={currentApp.serverInfo && currentApp.serverInfo.parseServerVersion} />
      );
    } else if (this.state.showRemoveColumnDialog) {
      let currentColumns = this.getClassColumns(className).map(column => column.name);
      extras = (
        <RemoveColumnDialog
          currentColumns={currentColumns}
          onCancel={() => this.setState({ showRemoveColumnDialog: false })}
          onConfirm={this.removeColumn} />
      );
    } else if (this.state.rowsToDelete) {
      extras = (
        <DeleteRowsDialog
          className={SpecialClasses[className] || className}
          selection={this.state.rowsToDelete}
          relation={this.state.relation}
          onCancel={() => this.setState({ rowsToDelete: null })}
          onConfirm={() => this.deleteRows(this.state.rowsToDelete)} />
      );
    } else if (this.state.showDropClassDialog) {
      extras = (
        <DropClassDialog
          className={className}
          onCancel={() => this.setState({
            showDropClassDialog: false,
            lastError: null,
            lastNote: null,
          })}
          onConfirm={() => this.dropClass(className)} />
      );
    } else if (this.state.showImportDialog) {
      extras = (
          <ImportDialog
              className={className}
              onCancel={() => this.setState({ showImportDialog: false })}
              onConfirm={(file) => this.importClass(className, file)} />
      );
    } else if (this.state.showImportRelationDialog) {
      extras = (
          <ImportRelationDialog
              className={className}
              onCancel={() => this.setState({ showImportRelationDialog: false })}
              onConfirm={(relationName, file) => this.importRelation(className, relationName, file)} />
      );
    } else if (this.state.showExportDialog) {
      extras = (
        <ExportDialog
          className={className}
          onCancel={() => this.setState({ showExportDialog: false })}
          onConfirm={() => this.exportClass(className)} />
      );
    } else if (this.state.showAttachRowsDialog) {
      extras = (
        <AttachRowsDialog
          relation={this.state.relation}
          onCancel={this.cancelAttachRows}
          onConfirm={this.confirmAttachRows}
        />
      )
    } else if (this.state.showAttachSelectedRowsDialog) {
      extras = (
        <AttachSelectedRowsDialog
          classes={this.props.schema.data.get('classes').keySeq().toArray()}
          onSelectClass={this.getClassRelationColumns}
          selection={this.state.selection}
          onCancel={this.cancelAttachSelectedRows}
          onConfirm={this.confirmAttachSelectedRows}
        />
      );
    } else if (this.state.showCloneSelectedRowsDialog) {
      extras = (
        <CloneSelectedRowsDialog
          className={className}
          selection={this.state.selection}
          onCancel={this.cancelCloneSelectedRows}
          onConfirm={this.confirmCloneSelectedRows}
        />
      );
    } else if (this.state.showEditRowDialog) {
      const classColumns = this.getClassColumns(className, false);
      // create object with classColumns as property keys needed for ColumnPreferences.getOrder function
      const columnsObject = {};
      classColumns.forEach((column) => {
        columnsObject[column.name] = column
      });
      // get ordered list of class columns
      const columnPreferences = this.context.currentApp.columnPreference || {}
      const columns = ColumnPreferences.getOrder(
        columnsObject,
        this.context.currentApp.applicationId,
        className,
        columnPreferences[className]
      );
      // extend columns with their type and targetClass properties
      columns.forEach(column => {
        const { type, targetClass } = columnsObject[column.name];
        column.type = type;
        column.targetClass = targetClass;
      });

      const { data, selection, newObject } = this.state;
      // at this moment only one row must be selected, so take the first and only one
      const selectedKey = Object.keys(selection)[0];
      // if selectedKey is string "undefined" => new row column 'objectId' was clicked
      let selectedId = selectedKey === 'undefined' ? undefined : selectedKey;
      // if selectedId is undefined and newObject is null it means new row was just saved and added to data array
      const isJustSavedObject = selectedId === undefined && newObject === null;
      // if new object just saved, remove new row selection and select new added row
      if (isJustSavedObject) {
        selectedId = data[0].id;
        this.setState({ selection: {} });
        this.selectRow(selectedId, true);
      }

      const row = data.findIndex(d => d.id === selectedId);

      const attributes = selectedId
        ? data[row].attributes
        : newObject.attributes;

      const selectedObject = {
        row: row,
        id: selectedId,
        ...attributes
      };

      extras = (
        <EditRowDialog
          className={className}
          columns={columns}
          selectedObject={selectedObject}
          handlePointerClick={this.handlePointerClick}
          setRelation={this.setRelation}
          handleShowAcl={this.handleShowAcl}
          onClose={this.closeEditRowDialog}
          updateRow={this.updateRow}
          confirmAttachSelectedRows={this.confirmAttachSelectedRows}
          schema={this.props.schema}
          useMasterKey={this.state.useMasterKey}
        />
      )
    } else if (this.state.openSecurityDialog) {
      let parseServerSupportsPointerPermissions = this.context.currentApp
        .serverInfo.features.schemas.editClassLevelPermissions;
      let currentColumns = this.getClassColumns(className);
      const userPointers = [];
      const schemaSimplifiedData = {};
      const classSchema = this.props.schema.data
        .get("classes")
        .get(this.props.params.className);
      if (classSchema) {
        classSchema.forEach(({ type, targetClass }, col) => {
          schemaSimplifiedData[col] = {
            type,
            targetClass
          };
          if (col === "objectId" || (this.state.isUnique && col !== this.state.uniqueField)) {
            return;
          }
          if (
            (type === "Pointer" && targetClass === "_User") ||
            type === "Array"
          ) {
            userPointers.push(col);
          }
        });
      }
      let perms = this.state.clp[className];
      extras = (
        <PermissionsDialog
          title="Edit Class Level Permissions"
          enablePointerPermissions={parseServerSupportsPointerPermissions}
          advanced={true}
          confirmText="Save CLP"
          columns={currentColumns}
          details={
            <a
              target="_blank"
              href="http://docs.parseplatform.org/ios/guide/#security"
            >
              Learn more about CLPs and app security
            </a>
          }
          permissions={perms}
          userPointers={userPointers}
          validateEntry={entry =>
            validateEntry(
              userPointers,
              entry,
              parseServerSupportsPointerPermissions
            )
          }
          onCancel={() => this.setState({ openSecurityDialog: false })}
          parseVersion={this.context.currentApp.serverInfo}
          onConfirm={perms =>
            this.handleCLPChange(perms)
              .then(() => this.setState({ openSecurityDialog: false }))
          }
        />
      );
    } else if (this.state.columnToDelete) {
      extras = (
        <ConfirmDeleteColumnDialog
          field={this.state.columnToDelete}
          onCancel={() => this.setState({ columnToDelete: null })}
          onConfirm={() => this.removeColumn(this.state.columnToDelete, true)}
        />
      )
    } else if (this.state.rowsToExport) {
      extras = (
        <ExportSelectedRowsDialog
          className={SpecialClasses[className] || className}
          selection={this.state.rowsToExport}
          onCancel={this.cancelExportSelectedRows}
          onConfirm={() => this.confirmExportSelectedRows(this.state.rowsToExport)}
        />
      );
    }

    let notification = null;
    const pageTitle = `${this.props.params.className} - Parse Dashboard`;

    if (this.state.lastError) {
      notification = (
        <Notification note={this.state.lastError} isErrorNote={true}/>
      );
    } else if (this.state.lastNote) {
      notification = (
        <Notification note={this.state.lastNote} isErrorNote={false}/>
      );
    }

    let tour = null;
    if (this.state.showTour) {
      const tourConfig = this.getTourConfig();
      tour = <Tour {...tourConfig} />;
    }

    return (
      <div>
        <Helmet>
          <title>{pageTitle}</title>
        </Helmet>
        {browser}
        {notification}
        {extras}
        {tour}
      </div>
    );
  }
}

Browser.contextTypes = {
  currentApp: PropTypes.instanceOf(ParseApp)
};
