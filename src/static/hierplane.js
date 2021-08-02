import { connect, Provider } from 'react-redux';
import React from 'react';
import ReactDOM from 'react-dom';
import Immutable from 'immutable';

import createStore from '../module/stores/create';
import { addAllNodeIds, collapseAllNodes, collapseDescendants } from '../module/stores/modules/ui';

import { Tree } from '../module/index.js';



/**
 * Renders a hierplane tree visualization from the provided tree.
 *
 * @param   {Object}    tree                      The tree to render.
 * @param   {Object}    [options]                 Optional command options.
 * @param   {string}    [options.target='body']   The element into which the tree should be rendered, this
 *                                                defaults to document.body.
 * @param   {string}    [options.theme='dark']    The theme to use, can be "light" or undefined.
 * @returns {function}  unmount                   A function which ummounts the resulting Component.
 */
export function renderTree(tree, options = { target: 'body', theme: 'dark' }) {
  const node = document.querySelector(options.target)

  const store = createStore({
    ui: {
      expandableNodeIds: Immutable.Set(),
      expandedNodeIds: Immutable.Set(),
      exploded: false,
      tree,
    }
  });
  const mapStateToProps = ({ ui }) => {
    return { tree: ui.tree }
  };
  // This is a hack, as to shim redux in at this level so that all dependencies of the tree are self contained
  const ConnectedTree = connect(mapStateToProps, { addAllNodeIds, collapseAllNodes, collapseDescendants })(Tree);

  ReactDOM.render(
    <Provider store={store}><ConnectedTree theme={options.theme ? options.theme : undefined} /></Provider>,
    // <Tree tree={tree} theme={options.theme ? options.theme : undefined} />,
    node
  );
  return function unmount() {
    ReactDOM.unmountComponentAtNode(node)
  };
}
