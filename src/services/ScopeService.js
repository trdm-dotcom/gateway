const { ScopeModel } = require('../model/scheme/ScopeScheme');
const { ScopeGroupModel } = require('../model/scheme/ScopeGroupScheme');
const { fsStat, fsReadFile } = require('../../promisify');
const config = require('../../config');
const fs = require('fs');

const SCOPE_KEY = 'qazxs&&wedc';
var scopeData = {};
var scopeDict = null;

function createScopeData() {
  return {
    t: new Date().getTime(),
    scopes: [], //Scope[]
    scopeDict: new Map(), //id - scope map
    scopeGroups: [], //ScopeGroup[]
    scopeGroupMap: new Map(), //{ [k: number]: ScopeGroup }
    publicScopes: [],
    scopeApis: [],
    scopeApiMap: new Map(), //{ [k: number]: OpenAPIV3.OperationObject }
    unmatchedOpenApiList: [],
  };
}

async function init() {
  scopeData = createScopeData();
  isExist = true;
  try {
    await fsStat(config.fileDir.scope);
  } catch (error) {
    isExist = false;
  }

  if (isExist) {
    console.warn('Scope data file exists => Start server');
    const buf = await fsReadFile(config.fileDir.scope);
    scopeData = JSON.parse(buf.toString('utf8'));
    scopeData.scopeDict = new Map();
    scopeData.scopeGroupMap = new Map();
    scopeData.scopeApiMap = new Map();
    if (scopeData.scopes != null) {
      scopeData.scopes.forEach((element) => {
        scopeData.scopeDict.set(element.id, element);
      });
    }

    if (scopeData.scopeGroups != null) {
      scopeData.scopeGroups.forEach((element) => {
        scopeData.scopeGroupMap.set(element.id, element);
      });
    }

    if (scopeData.scopeApis != null) {
      scopeData.scopeApis.forEach((element) => {
        scopeData.scopeApiMap.set(element.id, {
          summary: element.summary,
          parameters: element.parameters,
          requestBody: element.requestBody,
          responses: element.responses,
          security: element.security,
          tags: element.tags,
        });
      });
    }
    updateFromConfServiceRetry()
      .then(() => {
        findUnmatchedApi(scopeData);
      })
      .catch((err) => console.error(err));
  } else {
    console.error(`Scope data file not exists, send request to configuration service`);
    await updateFromConfServiceRetry();
    findUnmatchedApi();
  }
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

async function updateFromConfServiceRetry() {
  let exist = false;
  let time = 0;
  while (!exist) {
    try {
      await updateFromConfService();
      exist = true;
    } catch (e) {
      if (time < 100) {
        console.error('fail to load from conf. will retry', time, e);
        time++;
      } else {
        console.error('fail to load from conf', time);
      }
    }
  }
  return exist;
}

async function updateFromConfService() {
  let scopeDataTemp = createScopeData();
  await queryScopeGroups(scopeDataTemp);
  await queryScopes(scopeDataTemp);
  markPublicScope(scopeDataTemp);
  scopeData = scopeDataTemp;
  await saveScopeFile();
  scopeDict = createSortDict(scopeData.scopes);
}

async function queryScopeGroups(scopeData) {
  let data = await ScopeGroupModel.find(
    {},
    { _id: false, id: true, scopeGroupName: true, scopes: true }
  );
  for (let scopeGroup of data) {
    scopeGroup.scopes = [];
    scopeData.scopeGroupMap.set(scopeGroup.id, scopeGroup);
    scopeData.scopeGroups.push(scopeGroup);
  }
}

async function queryScopes(scopeData) {
  let data = await ScopeModel.find({}, { _id: false });
  for (let scope of data) {
    processUri(scope);
    scopeData.scopes.push(scope);
    scopeData.scopeDict.set(scope.id, scope);
    if (scope.groups != null && scope.groups.length > 0) {
      scope.groups.forEach((scopeGroupId) => {
        let scs = scopeData.scopeGroupMap.get(scopeGroupId);
        if (scs == null) {
          scopeData.scopeGroupMap.set(scopeGroupId, {
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

function markPublicScope(scopeData) {
  let publicScopes = [];
  let publicScopeGroups = config.scopes.publicScopeGroups;
  publicScopeGroups.forEach((scopeGroupName) => {
    let scopeGroup = scopeData.scopeGroups.find((scopeGroup) => {
      return scopeGroup.scopeGroupName === scopeGroupName;
    });
    if (scopeGroup != null) {
      scopeGroup.scopes.forEach((id) => {
        const scope = scopeData.scopeDict.get(id);
        if (scope != null) {
          scope.isPublic = true;
          publicScopes.push(scope);
        }
      });
    }
  });
}

async function saveScopeFile() {
  const content = JSON.stringify(scopeData, null, 2);
  fs.writeFileSync(config.fileDir.scope, content);
  console.log(`created scope data file at ${config.fileDir.scope} `);
}

function findUnmatchedApi(scopeData) {
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
