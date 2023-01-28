<!--
    USAGE

    <tn-table
        title="Titel der Tabelle" // required property!
        fulltextSearch="['col1', 'col2']" // non-required. Hier wird festgelegt, auf welchen Spalten eine Volltextsuche durchgeführt wird. Wenn gesetzt, wird das Suchfeld angezeigt.
        [alle weiteren Props von q-table können/müssen genutzt werden. Die columns-Property wurde erweitert, siehe unten]
    >
        <slots>Alle slots von q-table können genutzt werden</slots>
    </tn-table>

    Erweiterung von columns
    Jeder Eintrag im columns_Array von q-table kann erweitert werden um
        - filterBool: true
        - filterText: true
        - filterDate: true
        - filterGender: true
        - filterOptions: [{ value: '10', label: 'Wert1'}, {value: '20', label: 'Wert2'}] (für einen Filter nach beliebigen Optionen)
-->
<script>
  export default {
    name: 'MhTable'
  }
</script>

<script setup>
import { provide, reactive, ref, watch } from 'vue'

// Referenz auf den eingesetzten qtable (sobald der Component gemounted ist, ist qtable eine Referenz auf die Tabelle im DOM)
const qtable = ref(null);

// Standardmäßig können Funktionen hier nicht vom aufrufenden Component aus genutzt werden (Components mit "script setup" sind private by default)
// Daher müssen alle Funktionen (oder auch Variablen), die vom Parent-Component aus genutzt werden können sollen, hier exposed werden (ist dann quasi wie "public").

// Zugriff auf die scrollTo-Methode des qtable auch für Components ermöglichen, die mh-table einbinden
const scrollTo = function(index, edge) {
    qtable.value.scrollTo(index, edge);
}

// Zugriff auf die filteredSortedRows-Eigenschaft des qtable auch für Components ermöglichen, die mh-table einbinden
const getFilteredSortedRows = function() {
    return qtable.value.filteredSortedRows;
}

// Expose
defineExpose({scrollTo, getFilteredSortedRows});

// Provide Filter-Var
provide(filter);

const props = defineProps({
    title: {
        type: String,
        required: true
    },

    fulltextSearch: {
        type: Array
    }
});

const gridfilters = ref(''); // wird bei jeder Änderung von filters neu gesetzt, damit das Grid darauf reagieren kann. Das grid merkt nicht, wenn man verschachtelte Filter (wie in filters) hat.
const filters = reactive({ searchword: null, bool: {}, gender: {}, text: {}, date: {}, options: {}}); // filters benutzt für v-model, hier werden dynamisch die Filter-Werte hineingeschrieben

watch(filters, () => {
        gridfilters.value = Date.now().toString();
    },
    { deep: true }
);

function filter(rows) {
    let searchword = null;
    if (filters.searchword) {
        searchword = filters.searchword.toLowerCase();
    }

    const filteredRows = rows.filter((row, i) => {
        // Filter für Filter durchgehen. Wenn die row in einem Filter nicht drin ist,
        // ist sie aussortiert, also direkt mit return false zurück. Sonst weiter, um den
        // nächsten Filter zu durchlaufen
        // Nach Geschwindigkeit: Erst bool, dann gender, date, dann text, dann volltext

        // boolsche Filter
        for (const [key, value] of Object.entries(filters.bool)) {
            if (!value) {
                continue;
            }
            let checkvalue = (value == 'y') ? true : false;
            if (!row[key] === checkvalue) {
                return false;
            }
        }

        // gender-Filter
        for (const [key, value] of Object.entries(filters.gender)) {
            if (!value) {
                continue;
            }
            if (row[key] != value) {
                return false;
            }
        }

        // options-Filter
        for (const [key, value] of Object.entries(filters.options)) {
            if (value === null) {
                continue;
            }
            if (row[key] != value) {
                return false;
            }
        }

        // Date-Filter
        for (const [key, value] of Object.entries(filters.date)) {
            if (!value) {
                continue;
            }

            let dateArr = value.split('.');
            if (dateArr[0] == '00' && dateArr[1] == '00') { // Suche nach Jahr
                //console.log('suche nach Jahr', row[key], dateArr);
                if (!row[key].includes(dateArr[2] + '-')) {
                    return false;
                }
            } else { // Suche nach ganzem Datum
                if (row[key] != dateArr[2] + '-' + dateArr[1] + '-' + dateArr[0]) {
                    return false;
                }
            }
        }

        // Text-Filter
        for (const [key, value] of Object.entries(filters.text)) {
            if (!value) {
                continue;
            }

            let search = row[key];
            if (typeof search == 'number') {
                search = search.toString();
            }

            if (typeof value == 'number') {
                value = value.toString();
            }

            if (!search.toLowerCase().includes(value.toLowerCase())) {
                return false;
            }
        }

        // Der letzte Filter ist das Suchwort. Wenn er hier ankommt, ist die row in allen vorherigen
        // Filtern (sofern gesetzt) vorhanden. Der letzte Filter gibt true zurück, falls das Suchwort
        // vorkommt, sonst false.
        if (props.fulltextSearch && searchword) {
            let rowIsInFilter = false;
            const subset = Object.values(Object.fromEntries(
                props.fulltextSearch
                .filter(key => key in row)
                .map(key => { return [key, (row[key]) ? row[key].toString().toLowerCase() : '']; })
            ));

            for (let i = 0; i < subset.length; i++) {
                if (subset[i] && subset[i].includes(searchword)) {
                    rowIsInFilter = true;
                }
            }
            return rowIsInFilter;
        }

        // Wenn er hier unten ankommt, sind alle Filter durchlaufen. Also ist die row in allen gesetzten Filtern
        // enthalten -> return true.
        return true;
    });

    return filteredRows;
} // endof function filter

</script>

<template>
    <q-table
        class="tn-table"
        ref="qtable"
        v-bind="$attrs"
        :filter="gridfilters"
        :filter-method="filter"
    >
        <template v-slot:top>
            <div style="width: 100%" class="row">
                <div class="col-10 q-table__title">
                    {{ props.title }}
                </div>
                <div class="col-2" v-if="props.fulltextSearch">
                    <q-input dense debounce="400" color="primary" v-model="filters['searchword']">
                        <template v-slot:append>
                            <q-icon v-if="!filters['searchword']" name="search" />
                            <q-icon v-else name="cancel" @click="filters['searchword'] = null" class="cursor-pointer" />
                        </template>
                    </q-input>
                </div>
            </div>
        </template>

        <template v-slot:header-cell="props">
            <q-th :props="props">
                {{ props.col.label }}
                <q-btn v-if="props.col.filterBool" icon="filter_alt" :color="filters['bool'][props.col.name] ? 'green' : ''" size="1em" dense flat  v-on:click.stop>
                    <q-popup-proxy :offset="[100, 0]">
                        <q-banner dense>
                            <q-select
                                dense
                                style="width: 150px;"
                                v-model="filters['bool'][props.col.name]"
                                label="ja / nein"
                                :options="[{ label: 'ja', value: 'y'},{ label: 'nein', value: 'n'}]"
                                map-options
                                emit-value
                                clearable
                            />
                        </q-banner>
                    </q-popup-proxy>
                </q-btn>

                <q-btn v-if="props.col.filterText" icon="filter_alt" :color="filters['text'][props.col.name] ? 'green' : ''" size="1em" dense flat  v-on:click.stop>
                    <q-popup-proxy :offset="[100, 0]">
                        <q-banner dense>
                            <q-input
                                dense
                                debounce="400"
                                label="Textsuche"
                                style="width: 150px;"
                                v-model="filters['text'][props.col.name]"
                            >
                                <template v-slot:append>
                                    <q-icon v-if="!filters['text'][props.col.name]" name="search" />
                                    <q-icon v-else name="cancel" @click="filters['text'][props.col.name] = null" class="cursor-pointer" />
                                </template>
                            </q-input>
                        </q-banner>
                    </q-popup-proxy>
                </q-btn>

                <q-btn v-if="props.col.filterDate" icon="filter_alt" :color="filters['date'][props.col.name] ? 'green' : ''" size="1em" dense flat v-on:click.stop>
                    <q-popup-proxy :offset="[100, 0]">
                        <q-banner dense>
                            <q-input
                                dense
                                debounce="400"
                                style="width: 260px;"
                                v-model="filters['date'][props.col.name]"
                                label="TT.MM.JJJJ"
                                hint="Suche nach Jahr durch Ausnullen von Tag/Monat"
                                mask="##.##.####"
                            >
                                <template v-slot:append>
                                    <q-icon v-if="!filters['date'][props.col.name]" name="search" />
                                    <q-icon v-else name="cancel" @click="filters['date'][props.col.name] = null" class="cursor-pointer" />
                                </template>
                            </q-input>
                        </q-banner>
                    </q-popup-proxy>
                </q-btn>

                <q-btn v-if="props.col.filterGender" icon="filter_alt" :color="filters['gender'][props.col.name] ? 'green' : ''" size="1em" dense flat  v-on:click.stop>
                    <q-popup-proxy :offset="[100, 0]">
                        <q-banner dense>
                            <q-select
                                dense
                                style="width: 150px;"
                                v-model="filters['gender'][props.col.name]"
                                label="d / m / w"
                                :options="[{ label: 'divers', value: 'd'},{ label: 'männlich', value: 'm'},{ label: 'weiblich', value: 'w'}]"
                                map-options
                                emit-value
                                clearable
                            />
                        </q-banner>
                    </q-popup-proxy>
                </q-btn>

                <q-btn v-if="props.col.filterOptions" icon="filter_alt" :color="(filters['options'][props.col.name] !== undefined && filters['options'][props.col.name] !== null) ? 'green' : ''" size="1em" dense flat  v-on:click.stop>
                    <q-popup-proxy :offset="[100, 0]">
                        <q-banner dense>
                            <q-select
                                dense
                                style="width: 150px;"
                                v-model="filters['options'][props.col.name]"
                                label="Bitte wählen"
                                :options="props.col.filterOptions"
                                map-options
                                emit-value
                                clearable
                            />
                        </q-banner>
                    </q-popup-proxy>
                </q-btn>
            </q-th>
        </template>

        <!-- Slots, die bei der Benutzung reingegeben werden, übernehmen -->
        <template v-for="(_, slot) of $slots" v-slot:[slot]="scope"><slot :name="slot" v-bind="scope"/></template>
    </q-table>
</template>

<style lang="sass">
.tn-table
    .q-table__top,
    .q-table__bottom,
    thead tr:first-child th
        /* bg color is important for th; just specify one */
        background-color: white

    thead tr th
        position: sticky
        z-index: 1
    thead tr:first-child th
        top: 0

    /* this is when the loading indicator appears */
    &.q-table--loading thead tr:last-child th
        /* height of all previous header rows */
        top: 48px
</style>