/*
 * Copyright (c) 2016-present, Parse, LLC
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */
import PropTypes from 'lib/PropTypes';
import React     from 'react';
import styles    from 'components/FieldSettings/FieldSettings.scss';

let FieldSettings = ({label, input, labelWidth = 50, labelPadding, height, className, minHeight, textAlign, padding}) => {
  let classes = [styles.field];
  if (className) {
    classes.push(className);
  }
  return (
    <div className={classes.join(' ')} style={{minHeight, padding}}>
      <div className={styles.left} style={{ height: height, minHeight }}>
        {label}
      </div>
      <div className={styles.right} style={{ marginLeft: labelWidth + '%', minHeight, textAlign }}>
        {input}
      </div>
    </div>
  );
};

export default FieldSettings;

FieldSettings.propTypes = {
  label: PropTypes.node.describe(
    'The label content, placed on the left side of the Field. ' +
    'It can be any renderable content.'
  ),
  input: PropTypes.node.describe(
    'The input content, placed on the right side of the Field. ' +
    'It can be any renderable content.'
  ),
  className: PropTypes.string.describe(
    'A CSS class name to add to this field'
  ),
  labelWidth: PropTypes.number.describe(
    'A percentage value for the width of the left label. It cannot be 0.'
  ),
  labelPadding: PropTypes.number.describe(
    'A padding override for the Label of this field. This is automatically used by Modals.'
  ),
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).describe(
    'The height of the field. Can be a string containing any CSS unit, or a number of pixels. By default, it will expand to fit it\u2019s content, with a min-height of 80px.'
  ),
  padding: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).describe(
    'The padding of the field. Can be a string containing any CSS unit, or a number of pixels. By default, it will expand to fit it\u2019s content, with a min-height of 80px.'
  )
};
