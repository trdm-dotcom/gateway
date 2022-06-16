const { ScopeModel } = require('../model/scheme/ScopeScheme');
const { ScopeGroupModel } = require('../model/scheme/ScopeGroupScheme');

const SCOPE_KEY = 'qazxs&&wedc';
var scopeData = {};
var scopeDict = null;

async function init() {
  scopeData = await createScopeData();
  scopeDict = createSortDict(scopeData.scopes);
  findUnmatchedApi();
}

async function createScopeData() {
  let scopeDataInit = {
    t: new Date().getTime(),
    scopes: [],
    scopeDict: new Map(),
    scopeGroups: [],
    scopeGroupMap: new Map(),
    scopeApis: [],
    scopeApiMap: new Map(),
    unmatchedOpenApiList: [],
  };
  await queryScopeGroups(scopeDataInit);
  await queryScopes(scopeDataInit);
  return scopeDataInit;
}

function createSortDict(scopes) {
  const sortDict = {};
  for (let scope of scopes) {
    let scopeInDict = scopeData.scopeDict.get(scope.id);
    if (scopeInDict != null) {
      scope.isPublic = scopeInDict.isPublic;
    }
    let uri = scope.processedPattern;
    let partList = uri.split('/').filter((key) => key !== '');
    let currentPosition = sortDict;
    for (let index = 0; index < partList.length; index++) {
      const part = partList[index];
      if (currentPosition[part] == null) {
        currentPosition[part] = {};
      }
      currentPosition = currentPosition[part];
    }
    let array = currentPosition[SCOPE_KEY];
    if (array == null) {
      array = [];
      currentPosition[SCOPE_KEY] = array;
    }
    let data = {
      ...scope,
      scope,
    };
    if (typeof data.id === 'string') {
      data.id = parseInt(data.id);
    }
    if (data.scopeGroupIds != null) {
      for (let i = 0; i < data.scopeGroupIds.length; i++) {
        let value = data.scopeGroupIds[i];
        if (typeof value === 'string') {
          data.scopeGroupIds[i] = parseInt(value);
        }
      }
    }
    array.push(data);

    currentPosition = sortDict;
  }
  return sortDict;
}

async function queryScopeGroups(scopeDataInit) {
  let data = await ScopeGroupModel.find(
    {},
    { _id: false, id: true, scopeGroupName: true, scopes: true }
  );
  for (let scopeGroup of data) {
    scopeGroup.scopes = [];
    scopeDataInit.scopeGroupMap.set(scopeGroup.id, scopeGroup);
    scopeDataInit.scopeGroups.push(scopeGroup);
  }
}

async function queryScopes(scopeDataInit) {
  let data = await ScopeModel.find({}, { _id: false, groupIds: false });
  for (let scope of data) {
    processUri(scope);
    scopeDataInit.scopes.push(scope);
    scopeDataInit.scopeDict.set(scope.id, scope);
    if (scope.groups != null && scope.groups.length > 0) {
      scope.groups.forEach((scopeGroupId) => {
        let scs = scopeDataInit.scopeGroupMap.get(scopeGroupId);
        if (scs == null) {
          scopeDataInit.scopeGroupMap.set(scopeGroupId, {
            id: scopeGroupId,
            scopeGroupName: 'UNKNOWN',
            scopes: [scope.id],
          });
        } else {
          scs.scopes.push(scope.id);
        }
      });
    }
  }
}

function processUri(scope) {
  const uri = `/${scope.uriPattern.replace(':', '')}`;
  const parts = uri.split('/');
  parts.forEach((part) => {
    let p = part;
    if (part.startsWith('{') && part.endsWith('}')) {
      p = `:${part.substring(1, part.length - 2)}`;
    }
    if (scope.processedPattern == null) {
      scope.processedPattern = p;
    } else {
      scope.processedPattern += `/${p}`;
    }
  });
}

function findUnmatchedApi() {
  console.log(`total scope ${scopeData.scopes.length}`);
  let unmatchedScope = 0;
  for (let [value, data] of Object.entries(scopeData.scopeDict)) {
    if (scopeData.scopeApiMap.get(+value) == null) {
      unmatchedScope++;
      console.warn(`scope does not have open api: ${data.uriPattern}`);
    }
  }
  console.warn(`total unmatched scope ${unmatchedScope}`);
}

function findScope(uri, isPublic, scopeGroupIds) {
  uriParts = uri.split('/').filter((item) => item !== '');
  const paramNames = [];
  const paramValues = [];
  const scope = findScopeUriWithIndex(
    uriParts,
    null,
    paramNames,
    paramValues,
    isPublic,
    scopeGroupIds,
    null
  );
  const matcher = {
    remainingPathname: '',
    paramNames: paramNames,
    paramValues: paramValues,
  };
  return [scope, matcher];
}

function findScopeUriWithIndex(
  uriParts,
  scopeDict,
  paramNames,
  paramValues,
  isPublic,
  scopeGroupIds,
  index = 0
) {
  if (index === uriParts.length) {
    let array = scopeDict[SCOPE_KEY];
    if (array != null) {
      for (let i = 0; i < array.length; i++) {
        let scope = array[i];
        if (scope.isPublic != true || isPublic != true) {
          if (
            isPublic ||
            scopeGroupIds == null ||
            scopeGroupIds.find((id) => scope.scopeGroupIds.indexOf(id) > -1) != null
          ) {
            return scope.scope;
          }
        }
      }
    }
    return undefined;
  }

  let part = uriParts[index];
  let insideDict = scopeDict[part];
  if (insideDict == null) {
    let pathParams = Object.keys(scopeDict).filter((key) => key.startsWith(':'));
    for (let i = 0; i < pathParams.length; i++) {
      let paramName = pathParams[i];
      insideDict = scopeDict[paramName];
      let scopeId = this.findScopeUriWithIndex(
        uriParts,
        insideDict,
        paramNames,
        paramValues,
        isPublic,
        scopeGroupIds,
        index + 1
      );
      if (scopeId != null) {
        paramNames.push(paramName.substring(1));
        paramValues.push(part);
        return scopeId;
      }
    }
    return undefined;
  } else {
    return this.findScopeUriWithIndex(
      uriParts,
      insideDict,
      paramNames,
      paramValues,
      isPublic,
      scopeGroupIds,
      index + 1
    );
  }
}

module.exports = {
  findScope,
  init,
};
