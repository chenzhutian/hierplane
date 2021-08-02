import Immutable from 'immutable';
import { func } from 'prop-types';

/**
 * Action Type Constants
 */
export const ADD_ALL_NODE_IDS = 'ADD_ALL_NODE_IDS';
export const TOGGLE_NODE_STATE = 'TOGGLE_NODE_STATE';
export const COLLAPSE_NODE = 'COLLAPSE_NODE';
export const COLLAPSE_ALL_NODES = 'COLLAPSE_ALL_NODES';
export const COLLAPSE_DESCENDANTS = 'COLLAPSE_DESCENDANTS';
export const EXPAND_NODE = 'EXPAND_NODE';
export const EXPAND_ALL_NODES = 'EXPAND_ALL_NODES';
export const EXPAND_PATH_TO_NODE = 'EXPAND_PATH_TO_NODE';
export const SET_NODE_TYPE = 'SET_NODE_TYPE'
export const SET_DETAIL_TYPE = 'SET_DETAIL_TYPE'
export const TOGGLE_MACHINE_OUTPUT = 'TOGGLE_MACHINE_OUTPUT'

/**
 * Action Creators
 */

/**
 * Adds all the node ids.
 *
 * @param {Immutable.Set} ids - the node ids to be added
 * @returns {object}
 */
export function addAllNodeIds(ids) {
  return {
    ids,
    type: ADD_ALL_NODE_IDS,
  };
}

/**
 * Toggle the collapsed/expanded state of a node.
 *
 * @param {string} id - the id of the node to be toggled
 * @returns {object}
 */
export function toggleNode(id) {
  return {
    id,
    type: TOGGLE_NODE_STATE,
  };
}

/**
 * Explicitly collapse a node.
 *
 * @param {string} id - the id of the node to be collapsed
 * @returns {object}
 */
export function collapseNode(id) {
  return {
    id,
    type: COLLAPSE_NODE,
  };
}

/**
 * Explicitly expand a node.
 *
 * @param {string} id - the id of the node to be expanded
 * @returns {object}
 */
export function expandNode(id) {
  return {
    id,
    type: EXPAND_NODE,
  };
}

export function setNodeType(id, type) {
  return {
    id,
    type: SET_NODE_TYPE,
    payload: { type }
  }
}

export function setDetailType(id, type) {
  return {
    id,
    type: SET_DETAIL_TYPE,
    payload: { type }
  }
}

export function toggleMachineOutput(id) {
  return { id, type: TOGGLE_MACHINE_OUTPUT }
}

/**
 * Collapse all nodes.
 *
 * @returns {object}
 */
export function collapseAllNodes() {
  return {
    type: COLLAPSE_ALL_NODES,
  };
}

/**
 * Expand all nodes.
 *
 * @returns {object}
 */
export function expandAllNodes() {
  return {
    type: EXPAND_ALL_NODES,
  };
}

/**
 * Collapse decendants for a given node id. When navigating between parses on a focused node, we
 * keep that node expanded (i.e. show its immediate children), but force-collapse all of its other
 * descendants.
 *
 * @param {string} id - The node id that we're fetching an alternate parse for.
 * @returns {object}
 */
export function collapseDescendants(id) {
  return {
    id,
    type: COLLAPSE_DESCENDANTS,
  };
}

/**
 * Expand the path to the clicked node.
 *
 * @param {string} id - The node id that we're exposing the path to.
 * @returns {object}
 */
export function expandPathToNode(id) {
  return {
    id,
    type: EXPAND_PATH_TO_NODE,
  };
}

/**
 * UI Reducer
 */
const initialState = {
  expandableNodeIds: Immutable.Set(),
  expandedNodeIds: Immutable.Set(),
  exploded: false,
  tree: {},
};

export default (state = initialState, action) => {
  console.log('action', action)
  switch (action.type) {
    case ADD_ALL_NODE_IDS:
      return {
        ...state,
        expandableNodeIds: action.ids,
      };
    case COLLAPSE_NODE:
      return {
        ...state,
        exploded: false,
        expandedNodeIds: state.expandedNodeIds.delete(action.id),
      };
    case COLLAPSE_ALL_NODES:
      return {
        ...state,
        exploded: false,
        expandedNodeIds: Immutable.Set(),
      };
    case COLLAPSE_DESCENDANTS:
      return {
        ...state,
        exploded: false,
        expandedNodeIds: state.expandedNodeIds.filterNot(isChildOf(action.id)),
      };
    case EXPAND_NODE:
      return (function () {
        const { expandedNodeIds, expandableNodeIds } = state;
        const newExpandedNodeIds = expandedNodeIds.add(action.id);

        return {
          ...state,
          exploded: newExpandedNodeIds.equals(expandableNodeIds),
          expandedNodeIds: newExpandedNodeIds,
        };
      })();
    case SET_NODE_TYPE:
      return (function () {
        const { id } = action
        const { type } = action.payload
        const path = id.split('.')
        const { tree } = state
        console.log('path', path)
        const root = tree.root
        let node = root
        for (const idx of path.slice(1)) {
          node = root.children[+idx]
        }
        node.attributes[1] = type
        switch (type) {
          case 'opnode':
            node.attributes[2] = 'extreme'
            break
          case 'tasknode':
            node.attributes[2] = 'retrieve_value'
            break
          case 'tablenode':
            node.attributes[2] = 'attr'
            break
          case 'null':
            node.attributes = node.attributes.slice(0, 1)
        }

        return {
          ...state,
          tree: JSON.parse(JSON.stringify(tree))
        }
      })();
    case SET_DETAIL_TYPE:
      return (function () {
        const { id } = action
        const { type } = action.payload
        const path = id.split('.')
        const { tree } = state
        console.log('path', path)
        const root = tree.root
        let node = root
        for (const idx of path.slice(1)) {
          node = root.children[+idx]
        }
        node.attributes[2] = type
        return {
          ...state,
          tree: JSON.parse(JSON.stringify(tree))
        }
      })();
    case TOGGLE_MACHINE_OUTPUT:
      return (function() {
        const { id } = action
        const path = id.split('.')
        const { tree } = state
        const root = tree.root
        let node = root
        for (const idx of path.slice(1)) {
          node = root.children[+idx]
        }
        if(node.attributes[3]) {
          node.attributes = node.attributes.slice(0, 3)
        } else {
          node.attributes[3] = 'ML'
        }
        return {
          ...state,
          tree: JSON.parse(JSON.stringify(tree))
        }
      })();
    case TOGGLE_NODE_STATE:
      return (function () {
        const { expandedNodeIds: prevIds, expandableNodeIds } = state;
        const id = action.id;
        const newExpandedNodeIds = prevIds.has(id) ? prevIds.delete(id) : prevIds.add(id);

        return {
          ...state,
          exploded: newExpandedNodeIds.equals(expandableNodeIds),
          expandedNodeIds: newExpandedNodeIds,
        };
      })();
    case EXPAND_ALL_NODES:
      return {
        ...state,
        exploded: true,
        expandedNodeIds: Immutable.Set(state.expandableNodeIds),
      };
    case EXPAND_PATH_TO_NODE:
      return {
        ...state,
        expandedNodeIds: state.expandedNodeIds.union(pathToNode(action.id)),
      };
    default:
      return state;
  }
}

function isChildOf(parseId) {
  return nodeId => nodeId.startsWith(`${parseId}.`);
}

/**
 * Returns an Immutable.Set of node ids. The ids are the path from root to that id. For example,
 * given the id '0.0.0', this function will return ['0', '0.0', '0.0.0'].
 *
 * @param {string} id - the node id to get the path from the root node to.
 * @returns {Immutable.Set}
 */
function pathToNode(id) {
  if (!id) {
    return Immutable.Set();
  }

  // Recurse from child to parent by cutting off the last two characters, treating the shortened
  // string as a parent pointer.
  return id.length > 0 ? Immutable.Set([id]).union(pathToNode(id.slice(0, -2))) : [];
}
