import { PublicClientApplication } from '@azure/msal-browser'

const SCOPES = ['openid', 'profile', 'email', 'Tasks.Read']
const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0'
const STORAGE_KEYS = {
  personal: 'endor_ms_account_personal',
  work: 'endor_ms_account_work',
}

const LOGIN_HINTS = {
  personal: 'greg@ehrenberg.us',
  work: 'greg.ehrenberg@brightview.com',
}

function getClientId() {
  return import.meta.env.VITE_MICROSOFT_CLIENT_ID?.trim() || ''
}

function getRedirectUri() {
  return window.location.origin
}

function hasClientId() {
  return Boolean(getClientId())
}

let pcaPromise = null

async function getClient() {
  if (!hasClientId()) {
    throw new Error('Set VITE_MICROSOFT_CLIENT_ID in .env.local to connect Microsoft Tasks.')
  }

  if (!pcaPromise) {
    const instance = new PublicClientApplication({
      auth: {
        clientId: getClientId(),
        authority: 'https://login.microsoftonline.com/common',
        redirectUri: getRedirectUri(),
      },
      cache: {
        cacheLocation: 'localStorage',
      },
    })

    pcaPromise = instance.initialize().then(() => instance)
  }

  return pcaPromise
}

function saveAccountId(kind, homeAccountId) {
  localStorage.setItem(STORAGE_KEYS[kind], homeAccountId)
}

function loadAccountId(kind) {
  return localStorage.getItem(STORAGE_KEYS[kind])
}

function clearAccountId(kind) {
  localStorage.removeItem(STORAGE_KEYS[kind])
}

async function getStoredAccount(kind) {
  const homeAccountId = loadAccountId(kind)
  if (!homeAccountId) return null

  const client = await getClient()
  return client.getAccount({ homeAccountId })
}

export function getMicrosoftLoginHint(kind) {
  return LOGIN_HINTS[kind] || ''
}

export function isMicrosoftConfigured() {
  return hasClientId()
}

export async function getMicrosoftAccountSummary(kind) {
  if (!hasClientId()) {
    return {
      configured: false,
      connected: false,
      email: null,
    }
  }

  const account = await getStoredAccount(kind)

  return {
    configured: true,
    connected: Boolean(account),
    email: account?.username ?? null,
  }
}

export async function connectMicrosoftAccount(kind) {
  const client = await getClient()
  const loginResponse = await client.loginPopup({
    scopes: SCOPES,
    loginHint: getMicrosoftLoginHint(kind),
    prompt: 'select_account',
  })

  saveAccountId(kind, loginResponse.account.homeAccountId)

  return {
    email: loginResponse.account.username,
  }
}

export async function disconnectMicrosoftAccount(kind) {
  clearAccountId(kind)
}

async function getAccessTokenForKind(kind) {
  const client = await getClient()
  const account = await getStoredAccount(kind)

  if (!account) {
    throw new Error('Connect this Microsoft account first.')
  }

  try {
    const tokenResult = await client.acquireTokenSilent({
      account,
      scopes: SCOPES,
    })

    return tokenResult.accessToken
  } catch {
    const tokenResult = await client.acquireTokenPopup({
      account,
      scopes: SCOPES,
      prompt: 'select_account',
    })

    return tokenResult.accessToken
  }
}

async function fetchGraph(accessToken, path) {
  const response = await fetch(`${GRAPH_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Microsoft Graph error (${response.status}): ${errorBody}`)
  }

  return response.json()
}

export async function listMicrosoftTasks(kind) {
  const token = await getAccessTokenForKind(kind)
  const listsData = await fetchGraph(token, '/me/todo/lists?$top=20&$select=id,displayName')
  const lists = listsData.value ?? []

  if (!lists.length) {
    return {
      listName: null,
      tasks: [],
    }
  }

  const preferredList =
    lists.find((list) => list.displayName?.toLowerCase() === 'tasks') || lists[0]

  const tasksData = await fetchGraph(
    token,
    `/me/todo/lists/${preferredList.id}/tasks?$top=25&$orderby=importance desc,createdDateTime desc&$select=id,title,status,importance,dueDateTime,createdDateTime`,
  )

  return {
    listName: preferredList.displayName,
    tasks: tasksData.value ?? [],
  }
}
