/**
 * Sample trees to be used while developing locally, using `dev/static.html`.
 */
(function () {
  let sampleTrees = [];

  function renderSelectTreeUI(onTreeChanged = () => { }) {

    return (
      fetch('/api/list')
        .then(res => res.json())
        .then(list => {

          sampleTrees = list

          const div = document.createElement('div');
          div.classList.add('hpdev__select-tree');

          const select = document.createElement('select');
          select.id = 'tree_file'
          select.addEventListener('change', onTreeChanged);

          sampleTrees.forEach((tree, idx) => {
            const option = document.createElement('option');
            option.setAttribute('value', idx);
            option.textContent = tree;
            select.appendChild(option);
          });

          div.appendChild(select);

          document.body.insertBefore(div, document.body.firstElementChild);
          return renderTree(0);
        })
        .catch(err => {
          console.error('Error fetching sample trees:', err);
        })
    )

    // return (
    //   fetch('/api/samples')
    //     .then(res => res.json())
    //     .then(samples => {
    //       sampleTrees.push.apply(sampleTrees, samples);

    //       const div = document.createElement('div');
    //       div.classList.add('hpdev__select-tree');

    //       const select = document.createElement('select');
    //       select.addEventListener('change', onTreeChanged);

    //       sampleTrees.forEach((tree, idx) => {
    //         const option = document.createElement('option');
    //         option.setAttribute('value', idx);
    //         option.textContent = tree.text;
    //         select.appendChild(option);
    //       });

    //       div.appendChild(select);

    //       document.body.insertBefore(div, document.body.firstElementChild);
    //       renderTree(0);
    //     })
    //     .catch(err => {
    //       console.error('Error fetching sample trees:', err);
    //     })
    // );
  };



  const containerId = 'tree';
  const container = document.getElementById(containerId);
  let unmount = null;

  // function getTreeAtIdx(idx) {
  //   if (idx < 0 || idx >= sampleTrees.length) {
  //     throw new Error(`No tree at index ${idx}`);
  //   }
  //   return sampleTrees[idx];
  // };

  async function renderTree(idx) {
    if (typeof unmount == 'function') {
      unmount();
      unmount = null;
    }

    const tree = await fetch(`/api/tree?file=${sampleTrees[idx]}`).then(res => res.json())
    unmount = hierplane.renderTree(tree, { target: `#${containerId}` });
  }

  renderSelectTreeUI(event => renderTree(event.target.value))
})();
