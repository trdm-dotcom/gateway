const { ScopeModel } = require('../model/schema/ScopeSchema');
const { ScopeGroupModel } = require('../model/schema/ScopeGroupSchema');
const { Logger } = require('common');
const SCOPE_KEY = 'qazxs&&wedc';
var scopeData = {};
var scopeDict = null;

async function init() {
  scopeData = await createScopeData();
  scopeDict = createSortDict(scopeData.scopes);
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
  Logger.warn('Load scope complete');
  return scopeDataInit;
}

function createSortDict(scopes) {
  var sortDict = {};
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
  var data = await ScopeGroupModel.find(
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
  var data = await ScopeModel.find({}, { _id: false, groupIds: false });
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
  var uri = `/${scope.uriPattern.replace(':', '')}`;
  var parts = uri.split('/');
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

function findScope(uri, isPublic, scopeGroupIds) {
  var uriParts = uri.split('/').filter((item) => item !== '');
  var paramNames = [];
  var paramValues = [];
  var scope = findScopeUriWithIndex(
    uriParts,
    paramNames,
    paramValues,
    isPublic,
    scopeGroupIds,
    scopeDict
  );
  var matcher = {
    remainingPathname: '',
    paramNames: paramNames,
    paramValues: paramValues,
  };
  return [scope, matcher];
}

function findScopeUriWithIndex(
  uriParts,
  paramNames,
  paramValues,
  isPublic,
  scopeGroupIds,
  scopeDict,
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
  var part = uriParts[index];
  var insideDict = scopeDict[part];
  if (insideDict == null) {
    let pathParams = Object.keys(scopeDict).filter((key) => key.startsWith(':'));
    Logger.info(pathParams);
    for (let i = 0; i < pathParams.length; i++) {
      let paramName = pathParams[i];
      insideDict = scopeDict[paramName];
      let scopeId = findScopeUriWithIndex(
        uriParts,
        paramNames,
        paramValues,
        isPublic,
        scopeGroupIds,
        insideDict,
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
    return findScopeUriWithIndex(
      uriParts,
      paramNames,
      paramValues,
      isPublic,
      scopeGroupIds,
      insideDict,
      index + 1
    );
  }
}

module.exports = {
  findScope,
  init,
};
