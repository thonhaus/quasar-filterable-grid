import Table from '../components/Table.vue'

export default ({ app }) => {
  // we globally register our component in the app
  app.component('tn-table', Table);
}
