import {
  CheckboxEntry as DefaultCheckboxEntry,
  isCheckboxEntryEdited
} from '@bpmn-io/properties-panel';

const SUPPORTED_RESTRICTED_TYPES = new Set([
  'camunda:InputParameter',
  'camunda:OutputParameter',
  'camunda:In',
  'camunda:Out'
]);

// groups rendered by bpmn-js-element-templates for template-bound input/output properties
const ELEMENT_TEMPLATES_IO_GROUPS = new Set([
  'ElementTemplates__Input',
  'ElementTemplates__Output'
]);

const ELEMENT_TEMPLATES_CUSTOM_PROPERTIES_GROUP = 'ElementTemplates__CustomProperties';

export default class RestrictedIOPlugin {
  constructor(propertiesPanel, commandStack, CheckboxEntry = DefaultCheckboxEntry) {
    this.commandStack = commandStack;
    this.CheckboxEntry = CheckboxEntry;
    propertiesPanel.registerProvider(100, this);
  }

  getGroups(element) {

    return (groups) => {
      const { inputOutput, inOutMappings } = this.getRestrictedCandidates(element);
      const inputParams = (inputOutput && inputOutput.inputParameters) || [];
      const outputParams = (inputOutput && inputOutput.outputParameters) || [];

      groups
        .filter(g => g.id && (
          g.id.startsWith('CamundaPlatform__') ||
          ELEMENT_TEMPLATES_IO_GROUPS.has(g.id) ||
          g.id.startsWith(ELEMENT_TEMPLATES_CUSTOM_PROPERTIES_GROUP)
        ))
        .forEach(group => {
          if (group.id.startsWith(ELEMENT_TEMPLATES_CUSTOM_PROPERTIES_GROUP)) {
            this.addRestrictedEntriesToCustomProperties(group, { inputParams, outputParams });
            return;
          }

          (group.items || []).forEach(item => {
            if (!Array.isArray(item.entries)) {
              return;
            }

            const parameter = this.getParameterForItem(item, {
              inputParams,
              outputParams,
              inOutMappings,
              groupId: group.id
            });

            if (!parameter || !SUPPORTED_RESTRICTED_TYPES.has(parameter.$type)) {
              return;
            }

            this.insertRestrictedEntry(item, parameter);
          });
        });

      return groups;
    };
  }

  addRestrictedEntriesToCustomProperties(group, { inputParams, outputParams }) {
    if (!Array.isArray(group.entries)) {
      return;
    }

    group.entries.slice().forEach(entry => {
      const parameter = this.getParameterForElementTemplateProperty(entry.property, { inputParams, outputParams });

      if (!parameter || !SUPPORTED_RESTRICTED_TYPES.has(parameter.$type)) {
        return;
      }

      this.insertRestrictedEntryAfter(group.entries, entry, parameter);
    });
  }

  getRestrictedCandidates(element) {
    const bo = element.businessObject;
    const ext = bo.extensionElements;

    if (!ext || !Array.isArray(ext.values)) {
      return {
        inputOutput: null,
        inOutMappings: []
      };
    }

    return {
      inputOutput: ext.values.find(v => v.$type === 'camunda:InputOutput') || null,
      inOutMappings: ext.values.filter(v => v.$type === 'camunda:In' || v.$type === 'camunda:Out')
    };
  }

  getParameterForItem(item, { inputParams, outputParams, inOutMappings, groupId }) {
    if (groupId === 'CamundaPlatform__In' || groupId === 'CamundaPlatform__Out') {
      const anyMappingEntry = item.entries.find(e => e && e.mapping);
      if (anyMappingEntry) return anyMappingEntry.mapping;
      return inOutMappings.find(m => m.id && m.id === item.id) || null;
    }

    // Element Templates render dedicated Input/Output groups; the underlying
    // camunda:InputParameter/OutputParameter (when assigned) is exposed on the
    // "local variable assignment" / "process variable assignment" entry.
    if (groupId === 'ElementTemplates__Input') {
      const entry = item.entries.find(e => e && e.inputParameter);
      return entry ? entry.inputParameter : null;
    }

    if (groupId === 'ElementTemplates__Output') {
      const entry = item.entries.find(e => e && e.outputParameter);
      return entry ? entry.outputParameter : null;
    }

    const entryParameter = this.getParameterFromEntries(item.entries);

    if (entryParameter) {
      return entryParameter;
    }

    if (groupId === 'CamundaPlatform__Input' || groupId === 'CamundaPlatform__Output') {
      const paramName = item.label || item.id;

      return (
        inputParams.find(p => p.name === paramName) ||
        outputParams.find(p => p.name === paramName) ||
        null
      );
    }

    return inOutMappings.find(mapping => mapping.id && mapping.id === item.id) || null;
  }

  getParameterForElementTemplateProperty(property, { inputParams, outputParams }) {
    const binding = property && property.binding;

    if (!binding) {
      return null;
    }

    if (binding.type === 'camunda:inputParameter') {
      return inputParams.find(parameter => parameter.name === binding.name) || null;
    }

    if (binding.type === 'camunda:outputParameter') {
      return outputParams.find(parameter => {
        if (parameter.value === binding.source) {
          return true;
        }

        const definition = parameter.get && parameter.get('camunda:definition');

        if (!definition || !binding.scriptFormat) {
          return false;
        }

        return (
          definition.get('camunda:scriptFormat') === binding.scriptFormat &&
          definition.get('camunda:value') === binding.source
        );
      }) || null;
    }

    return null;
  }

  getParameterFromEntries(entries) {
    const localEntry = entries.find(e => e && e.id && e.id.endsWith('-local') && e.mapping);

    if (localEntry && localEntry.mapping) {
      return localEntry.mapping;
    }

    const parameterEntry = entries.find(e => e && (e.parameter || e.mapping));

    if (!parameterEntry) {
      return null;
    }

    return parameterEntry.parameter || parameterEntry.mapping;
  }

  insertRestrictedEntry(item, parameter) {
    const restrictedEntryId = `restricted-${item.id}`;

    const hasRestrictedEntry = item.entries.some(entry => entry && entry.id === restrictedEntryId);

    if (hasRestrictedEntry) {
      return;
    }

    const restrictedEntry = {
      id: restrictedEntryId,
      component: this.RestrictedCheckbox,
      type: 'input',
      parameter,
      isEdited: isCheckboxEntryEdited
    };

    const localIndex = item.entries.findIndex(entry => entry && entry.id && entry.id.endsWith('-local'));

    if (localIndex !== -1) {
      item.entries.splice(localIndex + 1, 0, restrictedEntry);
      return;
    }

    item.entries.push(restrictedEntry);
  }

  insertRestrictedEntryAfter(entries, entry, parameter) {
    const restrictedEntryId = `restricted-${entry.id}`;
    const hasRestrictedEntry = entries.some(existingEntry => existingEntry && existingEntry.id === restrictedEntryId);

    if (hasRestrictedEntry) {
      return;
    }

    const restrictedEntry = {
      id: restrictedEntryId,
      component: this.RestrictedCheckbox,
      type: 'input',
      parameter,
      isEdited: isCheckboxEntryEdited
    };

    const entryIndex = entries.indexOf(entry);

    if (entryIndex === -1) {
      entries.push(restrictedEntry);
      return;
    }

    entries.splice(entryIndex + 1, 0, restrictedEntry);
  }

  getInputOutput(element) {
    const bo = element.businessObject;
    const ext = bo.extensionElements;
    if (!ext) return null;

    return ext.values.find(v => v.$type === 'camunda:InputOutput');
  }


  RestrictedCheckbox = (props)=> {
    const { element, parameter } = props;

    return this.CheckboxEntry({
      element,
      id: 'restricted',
      label: 'Restricted',
      getValue: () => {
        return !!parameter.get('restricted');
      },
      setValue: (value) => {
        this.commandStack.execute('element.updateModdleProperties', {
          element: element, // the task shape
          moddleElement: parameter, // the actual parameter moddle element
          properties: {
            restricted: !!value
          }
        });
      }
    });
  };
}

RestrictedIOPlugin.$inject = [
  'propertiesPanel',
  'commandStack'
];
