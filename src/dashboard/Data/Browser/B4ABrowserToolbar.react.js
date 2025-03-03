import BrowserFilter        from 'components/BrowserFilter/BrowserFilter.react';
import BrowserMenu          from 'components/BrowserMenu/BrowserMenu.react';
import Icon                 from 'components/Icon/Icon.react';
import LoginDialog          from 'dashboard/Data/Browser/LoginDialog.react';
import MenuItem             from 'components/BrowserMenu/MenuItem.react';
import prettyNumber         from 'lib/prettyNumber';
import React, { useRef }    from 'react';
import SecurityDialog       from 'dashboard/Data/Browser/SecurityDialog.react';
import SecureFieldsDialog   from 'dashboard/Data/Browser/SecureFieldsDialog.react';
import Separator            from 'components/BrowserMenu/Separator.react';
import styles               from 'dashboard/Data/Browser/Browser.scss';
import Toolbar              from 'components/Toolbar/Toolbar.react';
import Toggle               from 'components/Toggle/Toggle.react';
import Button               from 'components/Button/Button.react'
import VideoTutorialButton  from 'components/VideoTutorialButton/VideoTutorialButton.react';
import ColumnsConfiguration
                      from 'components/ColumnsConfiguration/ColumnsConfiguration.react';
import SubMenuItem from '../../../components/BrowserMenu/SubMenuItem.react';

const apiDocsButtonStyle = {
  display: 'inline-block',
  height: '20px',
  border: '1px solid #169cee',
  'lineHeight': '20px',
  outline: '0',
  'textDecoration': 'none',
  'textAlign': 'center',
  'borderRadius': '5px',
  cursor: 'pointer',
  'minWidth': '90px',
  padding: '0 5px',
  'fontSize': '12px',
  'fontWeight': 'bold',
  'marginBottom': '4px',
}

let B4ABrowserToolbar = ({
    className,
    classNameForEditors,
    count,
    editCloneRows,
    perms,
    schema,
    filters,
    selection,
    relation,
    setCurrent,
    onFilterChange,
    onAbortAddRow,
    onAddColumn,
    onAddRow,
    onAddClass,
    onAttachRows,
    onAttachSelectedRows,
    onCancelPendingEditRows,
    onExportSelectedRows,
    onImport,
    onImportRelation,
    onCloneSelectedRows,
    onExport,
    onRemoveColumn,
    onDeleteRows,
    onDropClass,
    onChangeCLP,
    onEditPermissions,
    onRefresh,
    hidePerms,
    isUnique,
    uniqueField,
    handleColumnDragDrop,
    handleColumnsOrder,
    order,
    enableDeleteAllRows,
    enableImport,
    enableExportClass,
    enableSecurityDialog,
    enableColumnManipulation,
    enableClassManipulation,
    applicationId,
    onClickIndexManager,
    onClickSecurity,
    columns,
    onShowPointerKey,
    
    currentUser,
    useMasterKey,
    login,
    logout,
    toggleMasterKeyUsage,
  }) => {
  let selectionLength = Object.keys(selection).length;
  let isPendingEditCloneRows = editCloneRows && editCloneRows.length > 0;
  let details = [], lockIcon = false;
  if (count !== undefined) {
    if (count === 1) {
      details.push('1 object');
    } else {
      details.push(prettyNumber(count) + ' objects');
    }
  }

  let readWritePermissions = '';
  if (!relation && !isUnique) {
    if (perms && !hidePerms) {
      let read = perms.get && perms.find && perms.get['*'] && perms.find['*'];
      let write = perms.create && perms.update && perms.delete && perms.create['*'] && perms.update['*'] && perms.delete['*'];
      if (read && write) {
        // details.push('Public Read and Write enabled');
        readWritePermissions = 'Public Read and Write enabled';
      } else if (read) {
        // details.push('Public Read enabled');
        readWritePermissions = 'Public Read enabled';
      } else if (write) {
        // details.push('Public Write enabled');
        readWritePermissions = 'Public Write enabled';
      } else if ( !read && !write ) {
        readWritePermissions = 'Protected';
        lockIcon = true;
      }
    }
  }

  let protectedDialogRef = useRef(null);
  let loginDialogRef = useRef(null);

  const showProtected = () => protectedDialogRef.current.handleOpen();
  const showLogin = () => loginDialogRef.current.handleOpen();

  let menu = null;
  if (relation) {
    menu = (
      <BrowserMenu title='Edit' icon='more-icon' setCurrent={setCurrent}>
        <MenuItem
          disabled={isPendingEditCloneRows}
          text={`Create ${relation.targetClassName} and attach`}
          onClick={onAddRow}
        />
        <MenuItem
          disabled={isPendingEditCloneRows}
          text="Attach existing row"
          onClick={onAttachRows}
        />
        <Separator />
        <MenuItem
          disabled={selectionLength === 0 || isPendingEditCloneRows}
          text={selectionLength === 1 && !selection['*'] ? 'Detach this row' : 'Detach these rows'}
          onClick={() => onDeleteRows(selection)}
        />
      </BrowserMenu>
    );
  } else {
    menu = (
      <BrowserMenu title='Edit' icon='more-icon' setCurrent={setCurrent} active={currentUser ? true : false} >
        {isPendingEditCloneRows ? 
          <>
            <MenuItem text="Cancel all pending rows" onClick={onCancelPendingEditRows} />
            <Separator />
          </>  : <noscript /> }
        <MenuItem disabled={isPendingEditCloneRows} text='Add a row' onClick={onAddRow} />
        <SubMenuItem title="Security" setCurrent={setCurrent} onClick={null} disabled={isPendingEditCloneRows} >
          <MenuItem text="Class Level Permission" onClick={onClickSecurity} />
          <MenuItem text="Protected Fields" onClick={showProtected} />
        </SubMenuItem>
        {onAddRow && (
          <SubMenuItem
            title={currentUser ? 'Browsing' : 'Browse'}
            setCurrent={setCurrent}
            active={!!currentUser}
            disabled={isPendingEditCloneRows}
          >
            <MenuItem text={currentUser ? 'Switch User' : 'As User'} onClick={showLogin} />
            {currentUser ? <MenuItem text={<span>Use Master Key <Toggle type={Toggle.Types.HIDE_LABELS} value={useMasterKey} onChange={toggleMasterKeyUsage} switchNoMargin={true} additionalStyles={{ display: 'inline', lineHeight: 0, margin: 0, paddingLeft: 5 }} /></span>} onClick={toggleMasterKeyUsage} /> : <noscript />}
            {currentUser ? <MenuItem text={<span>Stop browsing (<b>{currentUser.get('username')}</b>)</span>} onClick={logout} /> : <noscript />}
          </SubMenuItem>
        )}
        {enableColumnManipulation ? <MenuItem disabled={isPendingEditCloneRows} text='Add a column' onClick={onAddColumn} /> : <noscript />}
        {enableClassManipulation ? <MenuItem disabled={isPendingEditCloneRows} text='Add a class' onClick={onAddClass} /> : <noscript />}
        <Separator />
        <MenuItem disabled={isPendingEditCloneRows} text='Change pointer key' onClick={onShowPointerKey} />
        <MenuItem
          disabled={!selectionLength || isPendingEditCloneRows}
          text={`Attach ${selectionLength <= 1 ? 'this row' : 'these rows'} to relation`}
          onClick={onAttachSelectedRows}
        />
        <Separator />
        <MenuItem
          disabled={!selectionLength || classNameForEditors.startsWith('_') || isPendingEditCloneRows}
          text={`Clone ${selectionLength <= 1 ? 'this row' : 'these rows'}`}
          onClick={onCloneSelectedRows}
        />
        <Separator />
        <MenuItem
          disabled={selectionLength === 0 || isPendingEditCloneRows}
          text={selectionLength === 1 && !selection['*'] ? 'Delete this row' : 'Delete these rows'}
          onClick={() => onDeleteRows(selection)} />
        {enableColumnManipulation ? <MenuItem disabled={isPendingEditCloneRows} text='Delete a column' onClick={onRemoveColumn} /> : <noscript />}
        {enableDeleteAllRows ? <MenuItem disabled={isPendingEditCloneRows} text='Delete all rows' onClick={() => onDeleteRows({ '*': true })} /> : <noscript />}
        {enableClassManipulation ? <MenuItem disabled={isPendingEditCloneRows} text='Delete this class' onClick={onDropClass} /> : <noscript />}
        {enableImport || enableExportClass ? <Separator /> : <noscript />}
        {enableImport ? 
          <SubMenuItem title="Import" setCurrent={setCurrent} onClick={null} disabled={isPendingEditCloneRows} >
            <MenuItem disabled={isPendingEditCloneRows} text='Class data' onClick={onImport} />
            <MenuItem disabled={isPendingEditCloneRows} text='Relation data' onClick={onImportRelation} />
          </SubMenuItem>
        : <noscript />}
        {enableExportClass ? 
          <SubMenuItem title="Export" setCurrent={setCurrent} onClick={null} disabled={isPendingEditCloneRows} >
            <MenuItem disabled={isPendingEditCloneRows} text='all rows as JSON' onClick={onExport} />
            <MenuItem disabled={!selectionLength || isPendingEditCloneRows} text={`${selectionLength} selected ${selectionLength <= 1 ? 'row' : 'rows'} as CSV`} onClick={() => onExportSelectedRows(selection)} />
            <MenuItem disabled={isPendingEditCloneRows} text='all rows as CSV' onClick={() => onExportSelectedRows({'*': true})} />
          </SubMenuItem>
          : <noscript />}
        <Separator />
        <MenuItem disabled={isPendingEditCloneRows} text='Index Manager' onClick={onClickIndexManager} />
        <MenuItem disabled={isPendingEditCloneRows} text="API Reference" onClick={() => {
          back4AppNavigation && back4AppNavigation.atApiReferenceClassesEvent()
          window.open(`${b4aSettings.DASHBOARD_PATH}/apidocs/${applicationId}${classApiId}`, '_blank')
        }} />
      </BrowserMenu>
    );
  }

  let subsection = className;
  if (relation) {
    subsection = `'${relation.key}' on ${relation.parent.id}`;
  } else if (subsection.length > 30) {
    subsection = subsection.substr(0, 30) + '\u2026';
  }
  const classes = [styles.addBtn];
  let onClick = onAddRow;
  if (isUnique) {
    classes.push(styles.toolbarButtonDisabled);
    onClick = null;
  }

  if (isPendingEditCloneRows) {
    classes.push(styles.toolbarButtonDisabled);
    onClick = null;
  }

  const userPointers = [];
  const schemaSimplifiedData = {};
  const classSchema = schema.data.get('classes').get(classNameForEditors);
  if (classSchema) {
    classSchema.forEach(({ type, targetClass }, col) => {
      schemaSimplifiedData[col] = {
        type,
        targetClass,
      };

      if (col === 'objectId' || isUnique && col !== uniqueField) {
        return;
      }
      if ((type ==='Pointer' && targetClass === '_User') || type === 'Array' ) {
        userPointers.push(col);
      }
    });
  }

  // variables used to define an API reference button on browser toolbar
  let classApiId = ''
  let apiDocsButton = ''
  let isCustomCLass = classNameForEditors && classNameForEditors.indexOf('_') === -1

  if (className && (className === 'User' || isCustomCLass)) {
    // set classApiId taking into count the User class special condition
    classApiId = `#${className === 'User' ? 'user-api' : `${className}-custom-class`}`
    apiDocsButton = <Button value='API Reference'
      primary={true}
      width={'90px'}
      additionalStyles={apiDocsButtonStyle}
      onClick={() => {
        back4AppNavigation && back4AppNavigation.atApiReferenceClassesEvent()
        window.open(`${b4aSettings.DASHBOARD_PATH}/apidocs/${applicationId}${classApiId}`, '_blank')
      }}
    />
  }
  // TODO: Set the videoTutorialUrl
  const videoTutorialUrl = 'https://youtu.be/0Ym9-BHI8Fg';
  const helpsection = (
    <span className="toolbar-help-section">
      {/* {apiDocsButton} */}
      <VideoTutorialButton url={videoTutorialUrl} additionalStyles={ { marginLeft: '8px', marginBottom: '4px' } } />
    </span>
  );

  return (
    <Toolbar
      relation={relation}
      filters={filters}
      readWritePermissions={readWritePermissions}
      lockIcon={lockIcon}
      onClickSecurity={onClickSecurity}
      section={relation ? `Relation <${relation.targetClassName}> | ` : `Class | ${details.join(' \u2022 ')}`}
      subsection={subsection}
      details={relation ? details.join(' \u2022 ') : details.join(' \u2022 ')}
      helpsection={helpsection}>
      {onAddRow && (
        <a className={classes.join(' ')} onClick={onClick}>
          <Icon name='add-outline' width={14} height={14} />
          <span>Row</span>
        </a>
      )}
      {onAddColumn && (
        <a className={classes.join(' ')} onClick={!isPendingEditCloneRows ? onAddColumn : null}>
          <Icon name='add-outline' width={14} height={14} />
          <span>Column</span>
        </a>
      )}
      {(
        <a className={styles.deleteBtn + ` ${(selectionLength >= 1) && !isPendingEditCloneRows && styles.active}`} onClick={selectionLength === 0 || isPendingEditCloneRows ? null : () => onDeleteRows(selection)}>
          <Icon name='delete-icon' width={24} height={20} />
        </a>
      )}
      <div className={styles.verticalSeparator}></div>
      <a className={styles.toolbarButton + ` ${isPendingEditCloneRows && styles.toolbarButtonDisabled}`} onClick={isPendingEditCloneRows ? null : onRefresh} title='Refresh'>
        <Icon name='refresh-icon' width={30} height={26} />
      </a>
      <BrowserFilter
        setCurrent={setCurrent}
        schema={schemaSimplifiedData}
        filters={filters}
        disabled={isPendingEditCloneRows}
        onChange={onFilterChange} />
      <ColumnsConfiguration
        disabled={isPendingEditCloneRows}
        handleColumnsOrder={handleColumnsOrder}
        handleColumnDragDrop={handleColumnDragDrop}
        order={order}
        className={classNameForEditors} />      
      {menu}
      <SecureFieldsDialog
        ref={protectedDialogRef}
        columns={columns}
        disabled={!!relation || !!isUnique}
        perms={perms}
        className={classNameForEditors}
        onChangeCLP={onChangeCLP}
        userPointers={userPointers}
        title='ProtectedFields'
        icon='locked-solid'
        onEditPermissions={onEditPermissions}
      />
      {onAddRow && (
        <LoginDialog
          ref={loginDialogRef}
          currentUser={currentUser}
          login={login}
          logout={logout}
        />
      )}
    </Toolbar>
  );
};

export default B4ABrowserToolbar;
