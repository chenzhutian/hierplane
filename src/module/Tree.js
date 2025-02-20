import MainStage from './MainStage.js';
import Passage from './Passage.js';
import SideBar from './pane/SideBar.js';
import PaneToggle from './pane/PaneToggle.js';
import ParseTreeToolbar from './ParseTreeToolbar.js';
import Toolbar from './Toolbar.js';
import {
  assignNodeIds,
  findAllNodeTypes,
  getCollapsibleNodeIds,
  generateStylesForNodeTypes,
  isSingleSegment,
  translateSpans
} from './helpers';

// TODO(@codeviking): These dependencies are shared by this component and others. Ideally I'd remove all
// explainer level requirements on these components.
import IconSprite from './IconSprite.js';

import { connect } from 'react-redux';

/* eslint-disable react/no-multi-comp */

// Local dependencies
import PropTypes from 'prop-types';

import React, { Component } from 'react';
import { Provider } from 'react-redux';

export default class Tree extends Component {
  static get defaultProps() {
    return {
      router: { transitionTo: () => { } },
      urlText: undefined,
      parser: 'default',
      theme: undefined,
      tree: undefined,
      readOnly: true,
      showSidebar: false
    };
  }

  /**
   * @property {object}               [router={}]         a react-router instance
   *                                                      TODO (codeviking): The router shouldn't
   *                                                      be a required property.
   * @property {string}               [urlText=undefined] The sentence text, as entered in the url.
   *                                                      TODO (codeviking): This property shouldn't
   *                                                      exist, there should only be a text property.
   *                                                      We should also remove the "empty" hack.
   * @property {string}               [parser=default]    An identifier for the parser to use when
   *                                                      submitting an API request.
   *                                                      TODO (codeviking): This should not be a
   *                                                      property of the tree.
   * @property {string}               [theme=undefined]   A property for applying a custom theme.
   * @property {object}               [tree=undefined]    The tree to render.
   * @property {readOnly}             [boolean=false]     If true, the UI doesn't allow the end
   *                                                      user to modify the sentence / submit it
   *                                                      to a backend API.
   * @property {showSidebar}          [boolean=true]      If false the sidebar isn't displayed.
   * @property {addAllNodeIds}        {function}          TODO (codeviking): What is this?
   * @property {collapseAllNodes}     {function}          A function which collapses all nodes
   * @property {collapseDescendants}  {function}          A function whichcollapses all descendent nodes
   */
  static get propTypes() {
    return {
      router: PropTypes.object.isRequired,
      urlText: PropTypes.string,
      parser: PropTypes.string,
      theme: PropTypes.string,
      tree: PropTypes.object,
      readOnly: PropTypes.bool,
      showSidebar: PropTypes.bool.isRequired,
      addAllNodeIds: PropTypes.func.isRequired,
      collapseAllNodes: PropTypes.func.isRequired,
      collapseDescendants: PropTypes.func.isRequired
    };
  }

  constructor(...args) {
    super(...args);
    this.state = {
      inputText: null,
      text: "",
      jsonUrl: "",
      styles: {},
      positions: {},
      linkLabels: {},
      data: {},
      jsonData: {},
      // Set layout to 'default' to enable support for side nesting of child nodes.
      // Set layout to 'canonical' to override side nesting and force all nesting down.
      layout: "default",
      selectedNodeId: null,
      hoverNodeId: null,
      selectedData: null,
      sideBarCollapsed: false,
      firstFocus: true,
      loading: null,
      firstLoad: null,
      emptyQuery: null,
      serverEndPoint: null,
      errorState: false,
    };
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.focusNode = this.focusNode.bind(this);
    this.hoverNode = this.hoverNode.bind(this);
    this.togglePane = this.togglePane.bind(this);
    this.fetchAltParse = this.fetchAltParse.bind(this);

    this.fetchData = this.fetchData.bind(this);
    this.setCollapsible = this.setCollapsible.bind(this);
    this.populateData = this.populateData.bind(this);
    this.populateError = this.populateError.bind(this);
  }


  onSave = (e) => {
    if ((window.navigator.platform.match("Mac") ? e.metaKey : e.ctrlKey) && e.keyCode == 83) {
      e.preventDefault();
      // Process the event here (such as click on submit button)
      console.log('save')
      this.props.saveTree()
    }
  }



  componentDidMount() {
    this.handleEmpty();
    //
    document.addEventListener('keydown', this.onSave, false)
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onSave)
  }

  handleEmpty() {
    const { urlText } = this.props;

    if (urlText === "empty") {
      this.setState({
        text: "",
        loading: false,
        firstLoad: false,
        emptyQuery: true,
      });
    } else {
      this.setState({
        text: decodeURIComponent(urlText),
        loading: true,
        firstLoad: true,
        emptyQuery: false,
      });
      this.fetchInitialParse(urlText);
    }
  }

  componentWillReceiveProps({ urlText, tree }) {
    const decoded = decodeURI(urlText);
    console.log('componentWillReceiveProps', tree)

    if (this.state.text !== decoded) {
      this.fetchInitialParse(decoded, tree);
    }

  }

  populateData(data, fetchPath, selectedData, includesSubTree = false) {
    this.setCollapsible(data, selectedData, includesSubTree);
    this.setState({
      inputText: data.text,
      text: data.text,
      styles: data.nodeTypeToStyle || generateStylesForNodeTypes(findAllNodeTypes(data.root)),
      positions: data.linkToPosition || {},
      linkLabels: data.linkNameToLabel || {},
      data: data.root,
      jsonData: data,
      loading: false,
      firstLoad: false,
      jsonUrl: fetchPath,
      errorState: false,
      selectedData,
    });
  }

  populateError(err) {
    console.error(err); // eslint-disable-line no-console
    this.setState({
      inputText: this.state.text,
      styles: {},
      positions: {},
      linkLabels: {},
      data: {},
      loading: false,
      errorState: true,
      selectedData: null,
    });
  }

  /**
   * Performs an ajax request and calls a function to handle the returned JSON data.
   *
   * @param {string} fetchPath - api endpoint
   * @param {string} method - HTTP method, e.g., GET, POST
   * @param {object} body - JSON post body
   * @param {boolean} includesSubTree - Whether a subtree is expected in the JSON that is returned.
   *                                    This is true if we're fetching an alternate parse.
   */
  fetchData(fetchPath, method, body, includesSubTree) {
    fetch(fetchPath, { method, body })
      .then(resp => resp.json())
      .then(data => {
        const { fetchedData, selectedData } = this.sanitizeResponse(data, includesSubTree);
        this.populateData(fetchedData, fetchPath, selectedData, includesSubTree);
      })
      .catch(this.populateError);
  }

  setCollapsible(fetchedData, selectedData, includesSubTree = false) {
    const { addAllNodeIds, collapseAllNodes, collapseDescendants } = this.props;
    // If this is a new query, i.e., not an alternate parse, then clear the expandedNodeIds.
    // Otherwise, collapse all the open descendant nodes.
    if (!includesSubTree) {
      if (fetchedData.text !== this.state.text)
        collapseAllNodes();
    } else {
      collapseDescendants(selectedData.id);
    }
    // Add the ids to the UI redux store.
    const root = fetchedData.root;
    addAllNodeIds(getCollapsibleNodeIds(root, isSingleSegment(root.nodeType)));
  }

  /**
   * Returns an object with the correct data to generate the UI from.
   *
   * @param {object} data - The response from the api call.
   * @param {boolean} includesSubTree - Whether a subtree is expected in the JSON that is returned.
   *                                    This is true if we're fetching an alternate parse.
   */
  sanitizeResponse(data, includesSubTree) {
    return {
      fetchedData: includesSubTree ? data.newCompleteJson : data,
      selectedData: includesSubTree ? data.selectedTree : null,
    };
  }

  // Fetch initial parse (takes a query string encoded as a URI):
  fetchInitialParse(q, tree) {
    const prefix = "/api/fetchParse.json?text=";
    const fetchPath = prefix + q + "&parser=" + this.props.parser;
    this.setState({
      serverEndPoint: true, // HTTP method is get so there is a server endpoint.
    });

    // Check if this is a static explainer instance
    if (!this.props.readOnly) {
      // Calls the method that sends data to the server and returns JSON:
      this.fetchData(fetchPath, "get", {}, false);
    } else {
      // Load static data
      const staticTree = tree || this.props.tree;
      if (staticTree) {
        staticTree.root = translateSpans(assignNodeIds(staticTree.root));
      }
      const { fetchedData, selectedData } = this.sanitizeResponse(staticTree, false);
      this.populateData(fetchedData, "", selectedData);
    }
  }

  // Fetch alternate parse (takes the data object for the focused node and
  // the direction of the control, prev or next, that called fetchAltParse):
  fetchAltParse(selectedData, direction) {
    const altParseInfo = selectedData.alternateParseInfo;
    // This is what gets sent to the server:
    const payload = {
      text: this.state.text,
      nodeId: selectedData.id,
      parseIndex: (direction === "next" ? altParseInfo.nextParse : altParseInfo.prevParse),
      rootJsonNode: this.state.data,
    };
    this.setState({
      loading: true,
      serverEndPoint: false, // HTTP method is post so there is no server endpoint.
    }, () => {
      this.fetchData("/api/fetchAlternateParse.json", "post", JSON.stringify(payload), true);
    });
  }

  handleSubmit(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (this.state.inputText !== null) {
        const url = encodeURIComponent(this.state.inputText);
        this.props.router.transitionTo(`/explain/${url}`);
        // If user submits the same query that has already been parsed then do another fetch
        if (this.state.inputText === this.state.text) {
          this.fetchInitialParse(url);
        }
        this.setState({
          selectedNodeId: null,
          selectedData: null,
          text: e.target.value,
          loading: true,
        });
      }
    }
  }

  handleChange(e) {
    this.setState({
      inputText: e.target.value,
    });
  }

  focusNode(data) {
    if (data !== "defocus") {
      this.setState({
        selectedNodeId: data.id,
        selectedData: data,
      });
      if (this.state.firstFocus) {
        this.setState({
          sideBarCollapsed: false,
          firstFocus: false,
        });
      }
    } else {
      this.setState({
        selectedNodeId: null,
        selectedData: null,
      });
    }
  }

  hoverNode(hoverNodeId) {
    this.setState({ hoverNodeId });
  }

  togglePane(mode) {
    switch (mode) {
      case "open":
        this.setState({
          sideBarCollapsed: false,
        });
        break;
      case "close":
        this.setState({
          sideBarCollapsed: true,
        });
        break;
      default:
        this.setState({
          sideBarCollapsed: !this.state.sideBarCollapsed,
        });
    }
  }

  render() {
    const { text,
      inputText,
      jsonUrl,
      styles,
      positions,
      linkLabels,
      data,
      jsonData,
      layout,
      selectedNodeId,
      hoverNodeId,
      selectedData,
      sideBarCollapsed,
      loading,
      firstLoad,
      emptyQuery,
      errorState,
      serverEndPoint } = this.state;


    const { readOnly, theme, showSidebar, saveTree } = this.props;

    return (
      <div className={`hierplane${theme !== undefined ? ` hierplane--theme-${theme}` : ""}`}>
        <div className="pane-container">
          <div className="pane pane--scroll">
            <Passage
              readOnly={readOnly}
              text={text}
              inputText={inputText}
              onKeyPress={this.handleSubmit}
              onChange={this.handleChange}
              focusNode={this.focusNode}
              selectedNodeId={selectedNodeId}
              hoverNodeId={hoverNodeId}
              loading={loading}
              data={data}
              styles={styles}
              hoverNode={this.hoverNode}
              emptyQuery={emptyQuery}
              errorState={errorState} />
            <div className="pane pane--fill">
              {!emptyQuery && !errorState && !loading && !readOnly ?
                <Toolbar
                  jsonUrl={jsonUrl}
                  jsonData={jsonData}
                  selectedData={selectedData}
                  serverEndPoint={serverEndPoint} /> : null}
              <ParseTreeToolbar
                disabled={!data || errorState || emptyQuery || loading} />
              <MainStage
                readOnly={readOnly}
                styles={styles}
                positions={positions}
                linkLabels={linkLabels}
                data={data}
                layout={layout}
                text={text}
                focusNode={this.focusNode}
                hoverNode={this.hoverNode}
                fetchAltParse={this.fetchAltParse}
                togglePane={this.togglePane}
                selectedNodeId={selectedNodeId}
                hoverNodeId={hoverNodeId}
                loading={loading}
                firstLoad={firstLoad}
                emptyQuery={emptyQuery}
                errorState={errorState} />
              <button style={{
                position: 'absolute',
                right: '20px',
                bottom: '20px',
                padding: '1rem',
                fontSize: '1.2rem'
              }}
                onClick={() => {
                  saveTree()
                }}
              >
                Save
              </button>

              <button style={{
                position: 'absolute',
                right: '120px',
                bottom: '20px',
                padding: '1rem',
                fontSize: '1.2rem'
              }}
                onClick={() => {
                  const select = document.getElementById('tree_file')
                  console.log(select, select.value, select.options.length)
                  select.value = Math.min(+select.value + 1, select.options.length).toString()
                  const evt = new Event('change', {})
                  select.dispatchEvent(evt)
                }}
              >
                Next
              </button>

              <button style={{
                position: 'absolute',
                right: '200px',
                bottom: '20px',
                padding: '1rem',
                fontSize: '1.2rem'
              }}
                onClick={() => {
                  const select = document.getElementById('tree_file')
                  select.value = Math.max(+select.value - 1, 0).toString()
                  const evt = new Event('change', {})
                  select.dispatchEvent(evt)
                }}
              >
                Prev
              </button>

            </div>
            <PaneToggle
              icon={"sidebar"}
              mode={"open"}
              sideBarCollapsed={sideBarCollapsed}
              togglePane={this.togglePane} />
          </div>
          {showSidebar ? (
            <SideBar
              readOnly={readOnly}
              text={text}
              selectedData={selectedData}
              loading={loading}
              sideBarCollapsed={sideBarCollapsed}
              fetchAltParse={this.fetchAltParse}
              togglePane={this.togglePane} />
          ) : null}
          <IconSprite />
        </div>
      </div>
    );
  }
}

// // We have no state to map to props, so we just return an empty object.
// const mapStateToProps = () => ({});
// const store = createStore();

// This is a hack, as to shim redux in at this level so that all dependencies of the tree are self contained
// const ConnectedTree = connect(mapStateToProps, { addAllNodeIds, collapseAllNodes, collapseDescendants })(Tree);
// export default ({ ...props }) => {
//   console.log('props', props)
//  return <Provider store={store}><ConnectedTree {...props} /></Provider>
// }
