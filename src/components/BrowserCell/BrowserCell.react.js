/*
 * Copyright (c) 2016-present, Parse, LLC
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */
import * as Filters              from 'lib/Filters';
import { List, Map }             from 'immutable';
import { dateStringUTC }         from 'lib/DateUtils';
import getFileName               from 'lib/getFileName';
import Parse                     from 'parse';
import Pill                      from 'components/Pill/Pill.react';
import React, { Component }      from 'react';
import styles                    from 'components/BrowserCell/BrowserCell.scss';
import PropTypes                 from "lib/PropTypes";
import { unselectable }          from 'stylesheets/base.scss';
import { DefaultColumns }        from 'lib/Constants';
import Tooltip                   from '../Tooltip/PopperTooltip.react';

class BrowserCell extends Component {
  constructor() {
    super();

    this.cellRef = React.createRef();
    this.copyableValue = undefined;
    this.state = {
      showTooltip: false,
      content: null,
      classes: []
    };
  }

  async renderCellContent() {
    let content = this.props.value;
      let isNewRow = this.props.row < 0;
      this.copyableValue = content;
      let classes = [styles.cell, unselectable];
      if (this.props.hidden) {
        content = this.props.value !== undefined || !isNewRow ? '(hidden)' : this.props.isRequired ? '(required)' : '(undefined)';
        classes.push(styles.empty);
      } else if (this.props.value === undefined) {
        if (this.props.type === 'ACL') {
          this.copyableValue = content = 'Public Read + Write';
        } else {
          this.copyableValue = content = '(undefined)';
          classes.push(styles.empty);
        }
        content = isNewRow && this.props.isRequired && this.props.value === undefined ? '(required)' : content;
      } else if (this.props.value === null) {
        this.copyableValue = content = '(null)';
        classes.push(styles.empty);
      } else if (this.props.value === '') {
        content = <span>&nbsp;</span>;
        classes.push(styles.empty);
      } else if (this.props.type === 'Pointer') {
        const defaultPointerKey = await localStorage.getItem(this.props.value.className) || 'objectId';

        let dataValue = this.props.value.id;
        if( defaultPointerKey !== 'objectId' ) {
          dataValue = this.props.value.get(defaultPointerKey);
          if ( dataValue && typeof dataValue === 'object' ){
            if ( dataValue instanceof Date ) {
              dataValue = dataValue.toLocaleString();
            }
            else {
              dataValue = '(undefined)';
            }
          }
          if ( !dataValue ) {
            dataValue = '(undefined)';
          }
        }

        if (this.props.value && this.props.value.__type) {
          const object = new Parse.Object(this.props.value.className);
          object.id = this.props.value.objectId;
          this.props.value = object;
        }

        content = this.props.onPointerClick ? (
          <Pill value={ dataValue } onClick={this.props.onPointerClick.bind(undefined, this.props.value)} followClick={true} />
        ) : (
          dataValue
        );

        this.copyableValue = this.props.value.id;
      }
      else if (this.props.type === 'Array') {
        if ( this.props.value[0] && typeof this.props.value[0] === 'object' && this.props.value[0].__type === 'Pointer' ) {
          const array = [];
          this.props.value.map( (v, i) => {
            if ( typeof v !== 'object' || v.__type !== 'Pointer' ) {
              throw new Error('Invalid type found in pointer array');
            }
            const object = new Parse.Object(v.className);
            object.id = v.objectId;
            array.push(
                <Pill key={i} value={v.objectId} onClick={this.props.onPointerClick.bind(undefined, object)} followClick={true} />
              );
          });
          content = <ul>
            { array.map( a => <li>{a}</li>) }
          </ul>
          if ( array.length > 1 ) {
            classes.push(styles.hasMore);
          }
          this.copyableValue = JSON.stringify(this.props.value);
        }
        else {
          this.copyableValue = content = JSON.stringify(this.props.value);
        }
      }
      else if (this.props.type === 'Date') {
        if (typeof value === 'object' && this.props.value.__type) {
          this.props.value = new Date(this.props.value.iso);
        } else if (typeof value === 'string') {
          this.props.value = new Date(this.props.value);
        }
        this.copyableValue = content = dateStringUTC(this.props.value);
      } else if (this.props.type === 'Boolean') {
        this.copyableValue = content = this.props.value ? 'True' : 'False';
      } else if (this.props.type === 'Object' || this.props.type === 'Bytes') {
        this.copyableValue = content = JSON.stringify(this.props.value);
      } else if (this.props.type === 'File') {
        const fileName = this.props.value.url() ? getFileName(this.props.value) : 'Uploading\u2026';
        content = <Pill value={fileName} fileDownloadLink={this.props.value.url()} />;
        this.copyableValue = fileName;
      } else if (this.props.type === 'ACL') {
        let pieces = [];
        let json = this.props.value.toJSON();
        if (Object.prototype.hasOwnProperty.call(json, '*')) {
          if (json['*'].read && json['*'].write) {
            pieces.push('Public Read + Write');
          } else if (json['*'].read) {
            pieces.push('Public Read');
          } else if (json['*'].write) {
            pieces.push('Public Write');
          }
        }
        for (let role in json) {
          if (role !== '*') {
            pieces.push(role);
          }
        }
        if (pieces.length === 0) {
          pieces.push('Master Key Only');
        }
        this.copyableValue = content = pieces.join(', ');
      } else if (this.props.type === 'GeoPoint') {
        this.copyableValue = content = `(${this.props.value.latitude}, ${this.props.value.longitude})`;
      } else if (this.props.type === 'Polygon') {
        this.copyableValue = content = this.props.value.coordinates.map(coord => `(${coord})`)
      } else if (this.props.type === 'Relation') {
        content = this.props.setRelation ? (
          <div style={{ textAlign: 'center' }}>
            <Pill onClick={() => this.props.setRelation(this.props.value)} value='View relation' followClick={true} />
          </div>
        ) : (
            'Relation'
          );
        this.copyableValue = undefined;
      }

      if (this.props.markRequiredField && this.props.isRequired && !this.props.value) {
        classes.push(styles.required);
      }

      this.setState({ ...this.state, content, classes })
  }

  async componentDidUpdate(prevProps) {
    if ( this.props.value !== prevProps.value ) {
      await this.renderCellContent();
    }
    if (this.props.current) {
      const node = this.cellRef.current;
      const { setRelation } = this.props;
      const { left, right, bottom, top } = node.getBoundingClientRect();

      // Takes into consideration Sidebar width when over 980px wide.
      // If setRelation is undefined, DataBrowser is used as ObjectPicker, so it does not have a sidebar.
      const leftBoundary = window.innerWidth > 980 && setRelation ? 300 : 0;

      // BrowserToolbar + DataBrowserHeader height
      const topBoundary = 126;

      if (left < leftBoundary || right > window.innerWidth) {
        node.scrollIntoView({ block: 'nearest', inline: 'start' });
      } else if (top < topBoundary || bottom > window.innerHeight) {
        node.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }

      if (!this.props.hidden) {
        this.props.setCopyableValue(this.copyableValue);
      }
    }
    if (prevProps.current !== this.props.current) {
      this.setState({ showTooltip: false });
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    if (nextState.showTooltip !== this.state.showTooltip || nextState.content !== this.state.content ) {
      return true;
    }
    const shallowVerifyProps = [...new Set(Object.keys(this.props).concat(Object.keys(nextProps)))]
      .filter(propName => propName !== 'value');
    if (shallowVerifyProps.some(propName => this.props[propName] !== nextProps[propName])) {
      return true;
    }
    const { value } = this.props;
    const { value: nextValue } = nextProps;
    if (typeof value !== typeof nextValue) {
      return true;
    }
    const isRefDifferent = value !== nextValue;
    if (isRefDifferent && typeof value === 'object') {
      return JSON.stringify(value) !== JSON.stringify(nextValue);
    }
    return isRefDifferent;
  }

  //#region Cell Context Menu related methods

  onContextMenu(event) {
    if (event.type !== 'contextmenu') { return; }
    event.preventDefault();

    const { field, hidden, onSelect, setCopyableValue, setContextMenu, row, col } = this.props;

    onSelect({ row, col });
    setCopyableValue(hidden ? undefined : this.copyableValue);

    const available = Filters.availableFilters(this.props.simplifiedSchema, this.props.filters, Filters.BLACKLISTED_FILTERS);
    const constraints = available && available[field];

    const { pageX, pageY } = event;
    const menuItems = this.getContextMenuOptions(constraints);
    menuItems.length && setContextMenu(pageX, pageY, menuItems);
  }

  getContextMenuOptions(constraints) {
    let { onEditSelectedRow, onAddRow, onAddColumn, onDeleteRows, onDeleteSelectedColumn, field, className } = this.props;
    const contextMenuOptions = [];

    const setFilterContextMenuOption = this.getSetFilterContextMenuOption(constraints);
    setFilterContextMenuOption && contextMenuOptions.push(setFilterContextMenuOption);

    const addFilterContextMenuOption = this.getAddFilterContextMenuOption(constraints);
    addFilterContextMenuOption && contextMenuOptions.push(addFilterContextMenuOption);

    const relatedObjectsContextMenuOption = this.getRelatedObjectsContextMenuOption();
    relatedObjectsContextMenuOption && contextMenuOptions.push(relatedObjectsContextMenuOption);

    onEditSelectedRow && contextMenuOptions.push({
      text: 'Edit row',
      callback: () => {
        let { objectId, onEditSelectedRow } = this.props;
        onEditSelectedRow(true, objectId);
      }
    });

    onAddRow && contextMenuOptions.push({
      text: 'Add Row',
      callback: onAddRow
    });

    onAddColumn && contextMenuOptions.push({
      text: 'Add Column',
      callback: onAddColumn
    });

    onDeleteRows && contextMenuOptions.push({
      text: 'Delete this row',
      callback: () => {
        let { objectId } = this.props;
        onDeleteRows({ [objectId]: true });
      }
    });

    let isTouchableColumn = true;
    isTouchableColumn = !(DefaultColumns.All.includes(field));
    if (className[0] === '_' && DefaultColumns[className].includes(field)) {
      isTouchableColumn = false;
    }
    isTouchableColumn && onDeleteSelectedColumn && contextMenuOptions.push({
      text: 'Delete this column',
      callback: () => {
        onDeleteSelectedColumn(field);
      },
    });

    if ( this.props.type === 'Pointer' ) {
      onEditSelectedRow && contextMenuOptions.push({
        text: 'Open pointer in new tab',
        callback: () => {
          let { value, onPointerCmdClick } = this.props;
          onPointerCmdClick(value);
        }
      });
    }

    return contextMenuOptions;
  }

  getSetFilterContextMenuOption(constraints) {
    if (constraints) {
      return {
        text: 'Set filter...', items: constraints.map(constraint => {
          const definition = Filters.Constraints[constraint];
          const text = `${this.props.field} ${definition.name}${definition.comparable ? (' ' + this.copyableValue) : ''}`;
          return {
            text,
            callback: this.pickFilter.bind(this, constraint)
          };
        })
      };
    }
  }

  getAddFilterContextMenuOption(constraints) {
    if (constraints && this.props.filters && this.props.filters.size > 0) {
      return {
        text: 'Add filter...', items: constraints.map(constraint => {
          const definition = Filters.Constraints[constraint];
          const text = `${this.props.field} ${definition.name}${definition.comparable ? (' ' + this.copyableValue) : ''}`;
          return {
            text,
            callback: this.pickFilter.bind(this, constraint, true)
          };
        })
      };
    }
  }

  /**
   * Returns "Get related records from..." context menu item if cell holds a Pointer
   * or objectId and there's a class in relation.
   */
  getRelatedObjectsContextMenuOption() {
    const { value, schema, onPointerClick } = this.props;

    const pointerClassName = (value && value.className)
      || (this.props.field === 'objectId' && this.props.className);
    if (pointerClassName) {
      const relatedRecordsMenuItem = { text: 'Get related records from...', items: [] };
      schema.data.get('classes').sortBy((v, k) => k).forEach((cl, className) => {
        cl.forEach((column, field) => {
          if (column.targetClass !== pointerClassName) { return; }
          relatedRecordsMenuItem.items.push({
            text: className, callback: () => {
              let relatedObject = value;
              if (this.props.field === 'objectId') {
                relatedObject = new Parse.Object(pointerClassName);
                relatedObject.id = value;
              }
              onPointerClick({ className, id: relatedObject.toPointer(), field })
            }
          })
        });
      });

      return relatedRecordsMenuItem.items.length ? relatedRecordsMenuItem : undefined;
    }
  }

  pickFilter(constraint, addToExistingFilter) {
    const definition = Filters.Constraints[constraint];
    const { filters, type, value, field } = this.props;
    const newFilters = addToExistingFilter ? filters : new List();
    let compareTo;
    if (definition.comparable) {
      switch (type) {
        case 'Pointer':
          compareTo = value.toPointer()
          break;
        case 'Date':
          compareTo = value.__type ? value : {
            __type: 'Date',
            iso: value
          };
          break;

        default:
          compareTo = value;
          break;
      }
    }

    this.props.onFilterChange(newFilters.push(new Map({
      field,
      constraint,
      compareTo
    })));
  }

  componentDidMount(){
    this.renderCellContent();
  }

  //#endregion

  render() {
    let { type, value, hidden, width, current, onSelect, onEditChange, setCopyableValue, isNewRow, markRequiredFieldRow, isRequired, onPointerCmdClick, row, col, readonly, field, onEditSelectedRow } = this.props;
    let classes = [...this.state.classes];

    if ( current ) {
      classes.push(styles.current);
    }

    if (markRequiredFieldRow === row && isRequired && !value) {
      classes.push(styles.required);
    }

    return readonly ? (
      <Tooltip placement='bottom' tooltip='Read only (CTRL+C to copy)' visible={this.state.showTooltip}>
        <span
          ref={this.cellRef}
          className={classes.join(' ')}
          style={{ width }}
          onClick={(e) => {
            if ( e.metaKey === true && type === 'Pointer') {
              onPointerCmdClick(value);
            } else {
              onSelect({ row, col });
              setCopyableValue(hidden ? undefined : this.copyableValue);
            }
          }}
          onDoubleClick={() => {
            if (field === 'objectId' && onEditSelectedRow) {
              onEditSelectedRow(true, value);
            } else {
              this.setState({ showTooltip: true });
              setTimeout(() => {
                this.setState({ showTooltip: false });
              }, 2000);
            }
          }}
          onContextMenu={this.onContextMenu.bind(this)}
        >
          {row < 0 || isNewRow ? '(auto)' : this.state.content}
        </span>
      </Tooltip>
    ) : (
      <span
        ref={this.cellRef}
        className={classes.join(' ')}
        style={{ width }}
        onClick={(e) => {
          if ( e.metaKey === true && type === 'Pointer') {
            onPointerCmdClick(value);
          } else {
            onSelect({ row, col });
            setCopyableValue(hidden ? undefined : this.copyableValue);
          }
        }}
        onDoubleClick={() => {
          // Since objectId can't be edited, double click event opens edit row dialog
          if (field === 'objectId' && onEditSelectedRow) {
            onEditSelectedRow(true, value);
          } else if (type !== 'Relation') {
            onEditChange(true)
          }
        }}
        onTouchEnd={e => {
          if (current && type !== 'Relation') {
            // The touch event may trigger an unwanted change in the column value
            if (['ACL', 'Boolean', 'File'].includes(type)) {
              e.preventDefault();
            }
          }}}
        onContextMenu={this.onContextMenu.bind(this)}
        >
          {this.state.content}
        </span>
    );
  }
}

BrowserCell.propTypes = {
  type: PropTypes.string.isRequired.describe('The column data type'),
  value: PropTypes.any.describe('The cell value (can be null/undefined as well)'),
  hidden: PropTypes.bool.describe('True if the cell value must be hidden (like passwords), false otherwise'),
  width: PropTypes.number.describe('The cell width style'),
  current: PropTypes.bool.describe('True if it is the BrowserCell selected, false otherwise'),
  onSelect: PropTypes.func.isRequired.describe('Function invoked when the selected flag should be updated'),
  onEditChange: PropTypes.func.isRequired.describe('Function invoked when the edit flag should be updated'),
  setCopyableValue: PropTypes.func.isRequired.describe('Function invoked when the copyable value has changed'),
  setRelation: PropTypes.func.isRequired.describe('Function invoked when the Relation link is clicked'),
  onPointerClick: PropTypes.func.isRequired.describe('Function invoked when the Pointer link is clicked'),
  readonly: PropTypes.bool.describe('True if the cell value is read only')
}

export default BrowserCell;
