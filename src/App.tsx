import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, MouseEvent as ReactMouseEvent } from 'react'
import './App.css'

type TabKey = 'characters' | 'battle' | 'world'

type Character = {
  id: string
  name: string
  race: string
  className: string
  subclass: string
  level: number
  background: string
  portrait: string
  notes: string
  color: string
  strength: number
  dexterity: number
  constitution: number
  intelligence: number
  wisdom: number
  charisma: number
  x: number
  y: number
}

type Monster = {
  id: string
  name: string
  image: string
  sizeSquares: number
  color: string
}

type BattleMap = {
  id: string
  name: string
  image: string
  columns: number
  rows: number
  cellSize: number
  gridBase?: {
    columns: number
    rows: number
    cellSize: number
  }
  monsterPlacements: Array<{
    id: string
    monsterId: string
    x: number
    y: number
    sizeSquares: number
  }>
}

type WorldMap = {
  id: string
  name: string
  image: string
  pin: {
    id: string
    name: string
    x: number
    y: number
    color: string
  } | null
}

type Account = {
  id: string
  username: string
  email: string
  password: string
  role: 'dm' | 'player'
  characters: Character[]
  monsters: Monster[]
  battleMaps: BattleMap[]
  worldMaps: WorldMap[]
}

const STORAGE_KEY = 'dnd-campaign-manager-v1'
const CURRENT_USER_KEY = 'dnd-campaign-current-user-v1'
const SAVE_LOCATION_KEY = 'dnd-campaign-save-location-name-v1'

const starterStats = {
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
}

const palette = ['#8b5cf6', '#f59e0b', '#34d399', '#f472b6', '#60a5fa', '#fb7185']

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const getBattleMapGridFromImage = (imageDataUrl: string) =>
  new Promise<{ columns: number; rows: number; cellSize: number }>((resolve) => {
    const image = new Image()

    image.onload = () => {
      const preferredTilePixels = 64
      const columns = clamp(Math.round(image.naturalWidth / preferredTilePixels), 10, 32)
      const rows = clamp(Math.round(image.naturalHeight / preferredTilePixels), 8, 22)
      const cellSize = clamp(
        Math.round(Math.min(image.naturalWidth / columns, image.naturalHeight / rows)),
        28,
        90,
      )

      resolve({ columns, rows, cellSize })
    }

    image.onerror = () => {
      resolve({ columns: 24, rows: 16, cellSize: 48 })
    }

    image.src = imageDataUrl
  })

const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'PC'

const createDefaultAvatar = (name: string, color: string) => {
  const initials = getInitials(name)
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${color}" />
          <stop offset="100%" stop-color="#1f2937" />
        </linearGradient>
      </defs>
      <rect width="220" height="220" rx="36" fill="url(#g)"/>
      <circle cx="110" cy="80" r="38" fill="rgba(255,255,255,0.25)"/>
      <path d="M54 170c18-32 42-48 56-48s38 16 56 48" fill="rgba(255,255,255,0.18)"/>
      <text x="110" y="128" text-anchor="middle" font-size="52" font-family="Arial, sans-serif" font-weight="700" fill="#fff">${initials}</text>
    </svg>
  `

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

const createDefaultMonsterAvatar = (_name: string, _color: string) => {
  const svg = `
    <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <title>Dungeons &amp; Dragons</title>
      <path fill="#ED1C24" d="M3.921 2.217C4.859 1.297 6.122.742 7.988.838c2.944.152 4.358 2.096 4.358 4.193 0 1.011-.536 2.363-1.276 3.323-.045-.044-.083-.087-.13-.131a21.28 21.28 0 00-.49-.436c-.484-.421-1.03-.905-1.397-1.426.807-1.413.346-3.414-1.359-3.414-.998 0-1.83.88-1.759 2.047-.26.552-.387 1.352-.337 2.062-.489-.295-.901-.618-1.095-1.067l-.626-1.445-.493 1.492a2.515 2.515 0 00-.088 1.135l-.01-.001a3.27 3.27 0 01-.555-1.57c-.18-1.908.764-2.964 1.19-3.383zm-.45 6.824c.114-.434-.778-1.173-1.11-1.311 1.224-.047 1.833.175 1.833.175-.32-.454-.423-1.146-.242-1.695.667 1.539 3.052 1.786 3.642 3.062-.084-.55-.625-1.169-1.253-1.53-.337-.838-.085-2.383.327-2.808-.145 2.22 3.149 3.49 3.832 5.105-.4-1.383-1.936-2.258-2.664-3.086-.24-.55-.056-1.48.205-1.799-.077 1.488 1.592 2.648 2.483 3.48 1.051.979 1.349 1.845 1.207 2.553.23.058.547.273.493.638.336-.075.677-.445.76-.673.165 1.104-.51 2.273-1.266 2.621 0 0 .203-.527-.141-.93-.34-.398-1.305-.403-1.631-.38 0 0 .4-.57.242-.86-.2-.357-2.087-.2-2.93.094.287-.03.967.044 1.205.14-.132.189-.478.989-.23 1.229.23.22.53-.162.53-.162s-.294.875-.082 1.078c.21.203.662.059.662.059-.281.687-1.379 1.16-2.146 1.16.274-.084.725-.553.795-.836-.2.097-.726.153-.928.117.248-.097.746-.712.592-1.405-.229-1.009-1.69-1.137-2.425-.649.238-.678.95-1.312 1.507-1.52a7.523 7.523 0 00-1.117-.273c.468-.369 1.642-.67 2.241-.639-.914-.225-2.586.057-3.352.927.245 0 .875.114 1.118.19-1.048.182-2.478 1.122-2.898 1.566.11-.584.28-1.08.136-1.43-.202-.497-.826-.704-2.07-.457.84-.809 2.56-1.31 2.676-1.751zm5.724.783c.166.563.39 1.08 1.097 1.08 0 0-.248-.779-1.097-1.08zm10.479 6.203c.533.088 1.282.635 1.282 1.417 0 1.275-1.652 1.667-2.566 1.469.97-.648.84-2.512-.326-3.178.395 1.045-.79 2.082-1.942 1.172-.641-.506-2.123-1.694-2.785-2.206-.66-.511-1.434-.214-1.74-.437-.348-.254-.125-.97-.6-1.236-.399-.222-.79-.098-1.253-.246-.42-.133-.733-.448-.68-.872-.178.303-.19.83.129 1.186.316.352.844.57 1.062.957.282.5-.193 1.196 1.062 2.143.6.452 1.53 1.195 2.137 1.707 1.021.862.476 1.94.61 2.879.155 1.096 1.072 1.704 1.682 1.858-.526-.46-.725-1.62.014-2.33.038.916.725 2.35 2.292 2.753 1.667.427 3.439-.482 3.807-1.122-.643.28-1.854-.022-2.353-.472 1.956.267 3.686-1.038 3.686-2.712 0-1.633-1.645-2.898-3.518-2.73zm-8.5.793c-.667 1.1-2.088 2.531-3.529 2.531-2.651 0-3.98-3.61-1.007-6.564a1.435 1.435 0 00-.4-.06c-.255 0-.504.064-.668.174l-1.168.776.264-1.432a2.14 2.14 0 01.093-.225c-.675.322-1.339.782-1.588 1.045L2.02 14.28l.122-1.703c.025-.133.054-.262.08-.385.06-.275.135-.618.089-.732a.214.214 0 00-.083-.091C1.68 11.775.177 13.055 0 14.936c0 0 .291-.395.544-.487.167-.062.313.017.153.487-.061.184-1.51 3.96 1.34 6.57 0 0-.312-.768-.124-1 .092-.114.212-.123.376.08.123.156.251.306.438.51.187.205.447.447.729.657.853.575 2.011 1.037 3.329 1.037 3.526 0 5.395-2.34 6.43-4.305a1.551 1.551 0 00-.155-.15 57.001 57.001 0 00-1.887-1.515zm1.91-2.884c.208.067.42.158.627.319.244.188.603.471.987.776.306-.65 1.009-2.003 2.097-3.204.98-1.08 2.69-1.184 3.588-.526.577-.502 2.569-.974 3.617-.687-.639-.668-1.996-1.564-3.496-1.564-1.237 0-1.936.583-2.113.32-.228-.336.837-.833.837-.833-1.46.058-2.523 1.711-2.966 1.505-.262-.12.395-.92.395-.92-1.336.746-2.455 2.328-2.688 3.291 1.229-1.448 3.614-2.486 5.166-2.267-2.629.122-4.891 2.276-6.05 3.79Z"/></svg>
  `

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

const getMonsterImage = (monster: Pick<Monster, 'image' | 'name' | 'color'> | null | undefined) =>
  monster?.image || createDefaultMonsterAvatar(monster?.name || 'Creature', monster?.color || '#a78bfa')

const getCharacterDisplayPortrait = (character: Pick<Character, 'portrait' | 'name' | 'color'> | null | undefined) =>
  typeof character?.portrait === 'string' && character.portrait.trim()
    ? character.portrait
    : createDefaultAvatar(character?.name || 'Character', character?.color || '#7c3aed')

const emptyCharacterForm = {
  name: '',
  race: '',
  className: '',
  subclass: '',
  level: '1',
  background: '',
  notes: '',
  strength: '10',
  dexterity: '10',
  constitution: '10',
  intelligence: '10',
  wisdom: '10',
  charisma: '10',
}

const normalizeAccount = (value: Partial<Account> | null | undefined): Account => ({
  id: typeof value?.id === 'string' ? value.id : crypto.randomUUID(),
  username: typeof value?.username === 'string' ? value.username : 'Campaign',
  email: typeof value?.email === 'string' ? value.email : '',
  password: typeof value?.password === 'string' ? value.password : '',
  role: value?.role === 'player' ? 'player' : 'dm',
  characters: Array.isArray(value?.characters)
    ? value.characters.map((character) => {
        const name = typeof character?.name === 'string' && character.name.trim() ? character.name : 'Character'
        const color = typeof character?.color === 'string' && character.color ? character.color : '#8b5cf6'

        return {
          ...character,
          name,
          color,
          portrait: typeof character?.portrait === 'string' ? character.portrait.trim() : '',
          x: Number.isFinite(character?.x) ? Number(character.x) : 0,
          y: Number.isFinite(character?.y) ? Number(character.y) : 0,
        }
      })
    : [],
  monsters: Array.isArray(value?.monsters)
    ? value.monsters.map((monster) => ({
        ...monster,
        name: typeof monster?.name === 'string' && monster.name.trim() ? monster.name : 'Creature',
        image:
          typeof monster?.image === 'string' && monster.image.trim()
            ? monster.image
            : createDefaultMonsterAvatar(
                typeof monster?.name === 'string' && monster.name.trim() ? monster.name : 'Creature',
                typeof monster?.color === 'string' && monster.color ? monster.color : '#a78bfa',
              ),
        color: typeof monster?.color === 'string' && monster.color ? monster.color : '#a78bfa',
        sizeSquares: clamp(Number(monster?.sizeSquares) || 1, 1, 12),
      }))
    : [],
  battleMaps: Array.isArray(value?.battleMaps)
    ? value.battleMaps.map((map) => ({
        ...map,
        monsterPlacements: Array.isArray(map?.monsterPlacements) ? map.monsterPlacements : [],
      }))
    : [],
  worldMaps: Array.isArray(value?.worldMaps)
    ? value.worldMaps.map((map) => ({
        ...map,
        pin: map?.pin ?? null,
      }))
    : [],
})

const loadAccounts = (): Account[] => {
  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY)
    if (!rawValue) {
      return []
    }

    const parsed = JSON.parse(rawValue)

    if (Array.isArray(parsed)) {
      return parsed.map((account) => normalizeAccount(account as Partial<Account>))
    }

    if (parsed && typeof parsed === 'object') {
      return [normalizeAccount(parsed as Partial<Account>)]
    }

    return []
  } catch {
    return []
  }
}

const createSafeFileName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'campaign'

const formatSavedTime = (value: Date | null) => {
  if (!value) {
    return 'not saved yet'
  }

  return value.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function App() {
  const [accounts, setAccounts] = useState<Account[]>(() => loadAccounts())
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(CURRENT_USER_KEY)
    } catch {
      return null
    }
  })
  const [tab, setTab] = useState<TabKey>('characters')
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null)
  const [selectedBattleMapId, setSelectedBattleMapId] = useState<string | null>(null)
  const [selectedWorldMapId, setSelectedWorldMapId] = useState<string | null>(null)
  const [isWorldMapFullscreen, setIsWorldMapFullscreen] = useState(false)
  const worldMapCanvasRef = useRef<HTMLDivElement>(null)
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '', role: 'dm' as 'dm' | 'player' })
  const [characterForm, setCharacterForm] = useState(emptyCharacterForm)
  const [portraitPreview, setPortraitPreview] = useState('')
  const [monsterForm, setMonsterForm] = useState({ name: '', sizeSquares: '1' })
  const [monsterPreview, setMonsterPreview] = useState('')
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved'>('saved')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [selectedMonsterId, setSelectedMonsterId] = useState<string | null>(null)
  const [selectedBattlePlacementId, setSelectedBattlePlacementId] = useState<string | null>(null)
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null)
  const [isDraggingWorldPin, setIsDraggingWorldPin] = useState(false)
  const [draggedToken, setDraggedToken] = useState<
    | { type: 'character'; id: string }
    | { type: 'monster'; id: string }
    | null
  >(null)
  const [saveFolderName, setSaveFolderName] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(SAVE_LOCATION_KEY)
    } catch {
      return null
    }
  })
  const [saveFolderHandle, setSaveFolderHandle] = useState<FileSystemDirectoryHandle | null>(null)

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsWorldMapFullscreen(document.fullscreenElement === worldMapCanvasRef.current)
    }

    document.addEventListener('fullscreenchange', syncFullscreenState)
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState)
  }, [])

  const currentUser = useMemo(
    () => accounts.find((account) => account.id === currentUserId) ?? null,
    [accounts, currentUserId],
  )

  const selectedCharacter = useMemo(
    () => currentUser?.characters.find((character) => character.id === selectedCharacterId) ?? null,
    [currentUser, selectedCharacterId],
  )

  const selectedBattleMap = useMemo(
    () => currentUser?.battleMaps.find((map) => map.id === selectedBattleMapId) ?? currentUser?.battleMaps[0] ?? null,
    [currentUser, selectedBattleMapId],
  )

  const selectedMonster = useMemo(
    () => currentUser?.monsters.find((monster) => monster.id === selectedMonsterId) ?? currentUser?.monsters[0] ?? null,
    [currentUser, selectedMonsterId],
  )

  const selectedWorldMap = useMemo(
    () => currentUser?.worldMaps.find((map) => map.id === selectedWorldMapId) ?? currentUser?.worldMaps[0] ?? null,
    [currentUser, selectedWorldMapId],
  )

  const persistCampaigns = async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts))

    if (currentUserId) {
      window.localStorage.setItem(CURRENT_USER_KEY, currentUserId)
    } else {
      window.localStorage.removeItem(CURRENT_USER_KEY)
    }

    if (currentUser && saveFolderHandle) {
      try {
        const fileName = `${createSafeFileName(currentUser.username)}.json`
        const fileHandle = await saveFolderHandle.getFileHandle(fileName, { create: true })
        const writable = await fileHandle.createWritable()
        await writable.write(JSON.stringify(currentUser, null, 2))
        await writable.close()
      } catch (error) {
        console.error('Could not save campaign to selected folder', error)
      }
    }

    setLastSavedAt(new Date())
    setSaveStatus('saved')
  }

  useEffect(() => {
    if (!accounts.length && !currentUserId) {
      window.localStorage.removeItem(STORAGE_KEY)
      window.localStorage.removeItem(CURRENT_USER_KEY)
      setLastSavedAt(new Date())
      setSaveStatus('saved')
      return
    }

    setSaveStatus('saving')
    const timeoutId = window.setTimeout(() => {
      void persistCampaigns()
    }, 180)

    return () => window.clearTimeout(timeoutId)
  }, [accounts, currentUserId, saveFolderHandle, currentUser])

  const handleManualSave = () => {
    void persistCampaigns()
  }

  const toggleWorldMapFullscreen = async () => {
    const canvas = worldMapCanvasRef.current
    if (!canvas) {
      return
    }

    if (document.fullscreenElement === canvas) {
      await document.exitFullscreen()
    } else {
      await canvas.requestFullscreen()
    }
  }

  const updateBattleMapCellSize = (mapId: string, nextCellSize: number) => {
    updateCurrentUser((account) => {
      const map = account.battleMaps.find((entry) => entry.id === mapId)
      if (!map) {
        return account
      }

      const gridBase = map.gridBase ?? {
        columns: map.columns,
        rows: map.rows,
        cellSize: Number(map.cellSize) || 48,
      }
      const cellSize = clamp(nextCellSize, 28, 90)
      const columns = clamp(Math.round(gridBase.columns * gridBase.cellSize / cellSize), 4, 60)
      const rows = clamp(Math.round(gridBase.rows * gridBase.cellSize / cellSize), 4, 40)

      return {
        ...account,
        characters: account.characters.map((character) => character.x < 0 || character.y < 0
          ? character
          : {
              ...character,
              x: clamp(Math.round(character.x * columns / map.columns), 0, columns - 1),
              y: clamp(Math.round(character.y * rows / map.rows), 0, rows - 1),
            }),
        battleMaps: account.battleMaps.map((entry) => entry.id !== mapId
          ? entry
          : {
              ...entry,
              gridBase,
              cellSize,
              columns,
              rows,
              monsterPlacements: entry.monsterPlacements.map((placement) => ({
                ...placement,
                x: clamp(Math.round(placement.x * columns / map.columns), 0, columns - placement.sizeSquares),
                y: clamp(Math.round(placement.y * rows / map.rows), 0, rows - placement.sizeSquares),
              })),
            }),
      }
    })
  }

  useEffect(() => {
    if (!currentUser) {
      return
    }

    if (!selectedBattleMapId && currentUser.battleMaps[0]) {
      setSelectedBattleMapId(currentUser.battleMaps[0].id)
    }

    if (!selectedWorldMapId && currentUser.worldMaps[0]) {
      setSelectedWorldMapId(currentUser.worldMaps[0].id)
    }
  }, [currentUser, selectedBattleMapId, selectedWorldMapId])

  const updateCurrentUser = (updater: (account: Account) => Account) => {
    if (!currentUserId) {
      return
    }

    setAccounts((previousAccounts) =>
      previousAccounts.map((account) =>
        account.id === currentUserId ? updater(account) : account,
      ),
    )
  }

  const handleAuthChange = (field: keyof typeof authForm, value: string) => {
    setAuthForm((previous) => ({ ...previous, [field]: value }))
  }

  const handleCharacterChange = (
    field: keyof typeof emptyCharacterForm,
    value: string,
  ) => {
    setCharacterForm((previous) => ({ ...previous, [field]: value }))
  }

  const handleMonsterChange = (field: 'name' | 'sizeSquares', value: string) => {
    setMonsterForm((previous) => ({ ...previous, [field]: value }))
  }

  const updateMonsterSize = (monsterId: string, nextSize: number) => {
    const safeSize = Math.min(Math.max(nextSize, 1), 12)

    updateCurrentUser((account) => ({
      ...account,
      monsters: account.monsters.map((monster) =>
        monster.id === monsterId ? { ...monster, sizeSquares: safeSize } : monster,
      ),
      battleMaps: account.battleMaps.map((map) => ({
        ...map,
        monsterPlacements: map.monsterPlacements.map((placement) =>
          placement.monsterId === monsterId
            ? {
                ...placement,
                sizeSquares: safeSize,
                x: Math.min(Math.max(placement.x, 0), map.columns - safeSize),
                y: Math.min(Math.max(placement.y, 0), map.rows - safeSize),
              }
            : placement,
        ),
      })),
    }))
  }

  const handleCharacterPortrait = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const imageData = await readFileAsDataUrl(file)
    setPortraitPreview(imageData)
  }

  const resetCharacterForm = () => {
    setCharacterForm(emptyCharacterForm)
    setPortraitPreview('')
    setEditingCharacterId(null)
  }

  const loadCharacterIntoForm = (character: Character) => {
    setEditingCharacterId(character.id)
    setSelectedCharacterId(character.id)
    setCharacterForm({
      name: character.name,
      race: character.race,
      className: character.className,
      subclass: character.subclass,
      level: String(character.level),
      background: character.background,
      notes: character.notes,
      strength: String(character.strength),
      dexterity: String(character.dexterity),
      constitution: String(character.constitution),
      intelligence: String(character.intelligence),
      wisdom: String(character.wisdom),
      charisma: String(character.charisma),
    })
    setPortraitPreview(character.portrait)
  }

  const handleAddCharacter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!currentUser) {
      return
    }

    const name = characterForm.name.trim()
    if (!name) {
      return
    }

    const color = palette[Number(name.length % palette.length)]

    if (editingCharacterId) {
      updateCurrentUser((account) => ({
        ...account,
        characters: account.characters.map((character) =>
          character.id === editingCharacterId
            ? {
                ...character,
                name,
                race: characterForm.race.trim() || 'Unknown',
                className: characterForm.className.trim() || 'Adventurer',
                subclass: characterForm.subclass.trim() || 'None',
                level: Number(characterForm.level) || 1,
                background: characterForm.background.trim() || 'Adventurer',
                portrait: portraitPreview || character.portrait || '',
                notes: characterForm.notes.trim(),
                strength: Number(characterForm.strength) || starterStats.strength,
                dexterity: Number(characterForm.dexterity) || starterStats.dexterity,
                constitution: Number(characterForm.constitution) || starterStats.constitution,
                intelligence: Number(characterForm.intelligence) || starterStats.intelligence,
                wisdom: Number(characterForm.wisdom) || starterStats.wisdom,
                charisma: Number(characterForm.charisma) || starterStats.charisma,
              }
            : character,
        ),
      }))

      setSelectedCharacterId(editingCharacterId)
      resetCharacterForm()
      return
    }

    const newCharacter: Character = {
      id: crypto.randomUUID(),
      name,
      race: characterForm.race.trim() || 'Unknown',
      className: characterForm.className.trim() || 'Adventurer',
      subclass: characterForm.subclass.trim() || 'None',
      level: Number(characterForm.level) || 1,
      background: characterForm.background.trim() || 'Adventurer',
      portrait: portraitPreview || '',
      notes: characterForm.notes.trim(),
      color,
      strength: Number(characterForm.strength) || starterStats.strength,
      dexterity: Number(characterForm.dexterity) || starterStats.dexterity,
      constitution: Number(characterForm.constitution) || starterStats.constitution,
      intelligence: Number(characterForm.intelligence) || starterStats.intelligence,
      wisdom: Number(characterForm.wisdom) || starterStats.wisdom,
      charisma: Number(characterForm.charisma) || starterStats.charisma,
      x: 0,
      y: 0,
    }

    updateCurrentUser((account) => ({
      ...account,
      characters: [...account.characters, newCharacter],
    }))

    setSelectedCharacterId(newCharacter.id)
    resetCharacterForm()
  }

  const removeCharacter = (characterId: string) => {
    updateCurrentUser((account) => ({
      ...account,
      characters: account.characters.filter((character) => character.id !== characterId),
    }))

    setSelectedCharacterId((previous) => (previous === characterId ? null : previous))
  }

  const removeBattleMap = (battleMapId: string) => {
    updateCurrentUser((account) => ({
      ...account,
      battleMaps: account.battleMaps.filter((map) => map.id !== battleMapId),
    }))

    setSelectedBattleMapId((previous) => (previous === battleMapId ? null : previous))
  }

  const removeMonster = (monsterId: string) => {
    updateCurrentUser((account) => ({
      ...account,
      monsters: account.monsters.filter((monster) => monster.id !== monsterId),
      battleMaps: account.battleMaps.map((map) => ({
        ...map,
        monsterPlacements: map.monsterPlacements.filter((placement) => placement.monsterId !== monsterId),
      })),
    }))

    setSelectedMonsterId((previous) => (previous === monsterId ? null : previous))
    setSelectedBattlePlacementId(null)
  }

  const handleBattleMapUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file || !currentUser) {
      return
    }

    const image = await readFileAsDataUrl(file)
    const { columns, rows, cellSize } = await getBattleMapGridFromImage(image)

    const uploadedMap: BattleMap = {
      id: crypto.randomUUID(),
      name: file.name.replace(/\.[^/.]+$/, '') || 'New battle map',
      image,
      columns,
      rows,
      cellSize,
      monsterPlacements: [],
    }

    updateCurrentUser((account) => ({
      ...account,
      battleMaps: [...account.battleMaps, uploadedMap],
    }))
    setSelectedBattleMapId(uploadedMap.id)
    event.target.value = ''
  }

  const handleWorldMapUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file || !currentUser) {
      return
    }

    const image = await readFileAsDataUrl(file)

    const uploadedMap: WorldMap = {
      id: crypto.randomUUID(),
      name: file.name.replace(/\.[^/.]+$/, '') || 'New world map',
      image,
      pin: null,
    }

    updateCurrentUser((account) => ({
      ...account,
      worldMaps: [...account.worldMaps, uploadedMap],
    }))
    setSelectedWorldMapId(uploadedMap.id)
    event.target.value = ''
  }

  const placeCharacterOnBattleMap = (x: number, y: number) => {
    if (!selectedCharacter || !selectedBattleMap || !currentUser) {
      return
    }

    updateCurrentUser((account) => ({
      ...account,
      characters: account.characters.map((character) =>
        character.id === selectedCharacter.id ? { ...character, x, y } : character,
      ),
    }))
  }

  const handleMonsterUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const image = await readFileAsDataUrl(file)
    setMonsterPreview(image)
    event.target.value = ''
  }

  const handleCharacterTileClick = (character: Character) => {
    setSelectedCharacterId(character.id)
    setSelectedMonsterId(null)
    setSelectedBattlePlacementId(null)
    loadCharacterIntoForm(character)
  }

  const handleAddMonster = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!currentUser) {
      return
    }

    const name = monsterForm.name.trim()
    if (!name) {
      return
    }

    const resolvedMonsterImage = monsterPreview || createDefaultMonsterAvatar(name, '#a78bfa')

    const newMonster: Monster = {
      id: crypto.randomUUID(),
      name,
      image: resolvedMonsterImage,
      sizeSquares: Number(monsterForm.sizeSquares) || 1,
      color: '#a78bfa',
    }

    updateCurrentUser((account) => ({
      ...account,
      monsters: [...account.monsters, newMonster],
    }))

    setSelectedMonsterId(newMonster.id)
    setMonsterForm({ name: '', sizeSquares: '1' })
    setMonsterPreview('')
  }

  const getBattleCellFromPointer = (event: ReactMouseEvent<HTMLDivElement>, battleMap: typeof selectedBattleMap) => {
    if (!battleMap) {
      return { x: 0, y: 0 }
    }

    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * battleMap.columns)
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * battleMap.rows)

    return {
      x: Math.min(Math.max(x, 0), battleMap.columns - 1),
      y: Math.min(Math.max(y, 0), battleMap.rows - 1),
    }
  }

  const moveCharacterToCell = (characterId: string, x: number, y: number) => {
    updateCurrentUser((account) => ({
      ...account,
      characters: account.characters.map((character) =>
        character.id === characterId ? { ...character, x, y } : character,
      ),
    }))
  }

  const moveMonsterPlacementToCell = (placementId: string, x: number, y: number) => {
    updateCurrentUser((account) => ({
      ...account,
      battleMaps: account.battleMaps.map((map) =>
        map.id !== selectedBattleMapId
          ? map
          : {
              ...map,
              monsterPlacements: map.monsterPlacements.map((placement) =>
                placement.id === placementId
                  ? { ...placement, x: Math.min(Math.max(x, 0), map.columns - placement.sizeSquares), y: Math.min(Math.max(y, 0), map.rows - placement.sizeSquares) }
                  : placement,
              ),
            },
      ),
    }))
  }

  const handleBattleMapClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!selectedBattleMap || !currentUser) {
      return
    }

    const { x, y } = getBattleCellFromPointer(event, selectedBattleMap)

    if (selectedMonsterId && selectedMonster) {
      const monsterSize = Math.max(1, Number(selectedMonster.sizeSquares) || 1)
      updateCurrentUser((account) => ({
        ...account,
        battleMaps: account.battleMaps.map((map) =>
          map.id === selectedBattleMap.id
            ? {
                ...map,
                monsterPlacements: [
                  ...map.monsterPlacements,
                  {
                    id: crypto.randomUUID(),
                    monsterId: selectedMonster.id,
                    x: Math.min(Math.max(x, 0), map.columns - monsterSize),
                    y: Math.min(Math.max(y, 0), map.rows - monsterSize),
                    sizeSquares: monsterSize,
                  },
                ],
              }
            : map,
        ),
      }))
      return
    }

    if (selectedCharacterId && selectedCharacter) {
      placeCharacterOnBattleMap(x, y)
    }
  }

  const handleBattleMapPointerMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!draggedToken || !selectedBattleMap) {
      return
    }

    const { x, y } = getBattleCellFromPointer(event, selectedBattleMap)

    if (draggedToken.type === 'character') {
      moveCharacterToCell(draggedToken.id, x, y)
      return
    }

    moveMonsterPlacementToCell(draggedToken.id, x, y)
  }

  const removeCharacterFromBoard = (characterId: string) => {
    updateCurrentUser((account) => ({
      ...account,
      characters: account.characters.map((character) =>
        character.id === characterId ? { ...character, x: -1, y: -1 } : character,
      ),
    }))
    setSelectedCharacterId(null)
  }

  const removeMonsterPlacementFromBoard = (placementId: string) => {
    updateCurrentUser((account) => ({
      ...account,
      battleMaps: account.battleMaps.map((map) =>
        map.id === selectedBattleMapId
          ? { ...map, monsterPlacements: map.monsterPlacements.filter((placement) => placement.id !== placementId) }
          : map,
      ),
    }))
    setSelectedBattlePlacementId(null)
  }

  const updateWorldMapPin = (x: number, y: number) => {
    if (!selectedWorldMap || !currentUser) {
      return
    }

    updateCurrentUser((account) => ({
      ...account,
      worldMaps: account.worldMaps.map((map) =>
        map.id === selectedWorldMap.id
          ? {
              ...map,
              pin: map.pin
                ? { ...map.pin, x, y }
                : { id: crypto.randomUUID(), name: 'Landmark', x, y, color: '#ef4444' },
            }
          : map,
      ),
    }))
  }

  const getWorldMapPosition = (event: ReactMouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1)
    const y = Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1)
    return { x, y }
  }

  const addWorldPin = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!selectedWorldMap || !currentUser) {
      return
    }

    if (selectedWorldMap.pin) {
      const { x, y } = getWorldMapPosition(event)
      updateWorldMapPin(x, y)
      return
    }

    const { x, y } = getWorldMapPosition(event)
    updateWorldMapPin(x, y)
  }

  const handleWorldMapDragMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!isDraggingWorldPin || !selectedWorldMap || !currentUser) {
      return
    }

    const { x, y } = getWorldMapPosition(event)
    updateWorldMapPin(x, y)
  }

  const chooseSaveFolder = async () => {
    const picker = window as Window & {
      showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>
    }

    if (!picker.showDirectoryPicker) {
      window.alert('This browser does not support picking a folder. The app will still save to local browser storage as a fallback.')
      return
    }

    try {
      const directoryHandle = await picker.showDirectoryPicker()
      setSaveFolderHandle(directoryHandle)
      setSaveFolderName(directoryHandle.name)
      window.localStorage.setItem(SAVE_LOCATION_KEY, directoryHandle.name)
    } catch {
      setSaveFolderName((previous) => previous ?? 'Browser storage fallback')
    }
  }

  const exportCampaignToFile = () => {
    if (!currentUser) {
      return
    }

    const payload = JSON.stringify(currentUser, null, 2)
    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${createSafeFileName(currentUser.username)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const importCampaignFromFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      const raw = await file.text()
      const importedCampaign = JSON.parse(raw) as Account

      if (!importedCampaign || typeof importedCampaign.username !== 'string') {
        return
      }

      const normalizedCampaign: Account = {
        id: importedCampaign.id || crypto.randomUUID(),
        username: importedCampaign.username,
        email: importedCampaign.email || '',
        password: importedCampaign.password || '',
        role: importedCampaign.role === 'player' ? 'player' : 'dm',
        characters: Array.isArray(importedCampaign.characters) ? importedCampaign.characters : [],
        monsters: Array.isArray(importedCampaign.monsters) ? importedCampaign.monsters : [],
        battleMaps: Array.isArray(importedCampaign.battleMaps) ? importedCampaign.battleMaps.map((map) => ({
          ...map,
          monsterPlacements: Array.isArray(map.monsterPlacements) ? map.monsterPlacements : [],
        })) : [],
        worldMaps: Array.isArray(importedCampaign.worldMaps)
          ? importedCampaign.worldMaps.map((map) => ({
              ...map,
              pin: map.pin ?? null,
            }))
          : [],
      }

      setAccounts((previous) => {
        const existingIndex = previous.findIndex((account) => account.id === normalizedCampaign.id)
        if (existingIndex >= 0) {
          const next = [...previous]
          next[existingIndex] = normalizedCampaign
          return next
        }

        return [normalizedCampaign, ...previous]
      })
      setCurrentUserId(normalizedCampaign.id)
      setSelectedCharacterId(normalizedCampaign.characters[0]?.id ?? null)
      setSelectedBattleMapId(normalizedCampaign.battleMaps[0]?.id ?? null)
      setSelectedWorldMapId(normalizedCampaign.worldMaps[0]?.id ?? null)
    } catch (error) {
      console.error('Unable to import campaign file', error)
    } finally {
      event.target.value = ''
    }
  }

  const logout = () => {
    setCurrentUserId(null)
    setSelectedCharacterId(null)
    setSelectedBattleMapId(null)
    setSelectedWorldMapId(null)
  }

  if (!currentUser) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-header">
            <p className="eyebrow">Local campaign</p>
            <h1>The DND Manager</h1>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              const name = authForm.username.trim()
              if (!name) {
                return
              }

              const newCampaign: Account = {
                id: crypto.randomUUID(),
                username: name,
                email: '',
                password: '',
                role: 'dm',
                characters: [],
                monsters: [],
                battleMaps: [],
                worldMaps: [],
              }

              setAccounts((previous) => [newCampaign, ...previous])
              setCurrentUserId(newCampaign.id)
              setAuthForm({ username: '', email: '', password: '', role: 'dm' })
              setTab('characters')
            }}
            className="auth-form"
          >
            <button type="button" className="ghost-button" onClick={chooseSaveFolder}>
              {saveFolderName ? `Save folder: ${saveFolderName}` : 'Choose save folder'}
            </button>

            <label>
              Campaign name
              <input
                value={authForm.username}
                onChange={(event) => handleAuthChange('username', event.target.value)}
                placeholder="The Shattered Crown"
              />
            </label>

            <button type="submit" className="primary-button" disabled={!saveFolderName && 'showDirectoryPicker' in window}>
              Create local campaign
            </button>

            <label className="upload-button">
              Import campaign file
              <input type="file" accept="application/json" onChange={importCampaignFromFile} />
            </label>
          </form>

          {accounts.length > 0 && (
            <div className="roster-list" style={{ marginTop: '1.5rem' }}>
              {accounts.map((campaign) => (
                <button
                  type="button"
                  key={campaign.id}
                  className="character-tile"
                  onClick={() => {
                    setCurrentUserId(campaign.id)
                    setTab('characters')
                  }}
                >
                  <div>
                    <strong>{campaign.username}</strong>
                    <small>{campaign.characters.length} characters</small>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <p className="eyebrow">Dungeon manager</p>
          <h2>The DND Manager</h2>
        </div>

        <nav className="nav-list">
          <button type="button" className={tab === 'characters' ? 'active' : ''} onClick={() => setTab('characters')}>
            Characters
          </button>
          <button type="button" className={tab === 'battle' ? 'active' : ''} onClick={() => setTab('battle')}>
            Battle maps
          </button>
          <button type="button" className={tab === 'world' ? 'active' : ''} onClick={() => setTab('world')}>
            World maps
          </button>
        </nav>

        <div className="sidebar-card">
          <p className="label">{currentUser.role === 'dm' ? 'Campaign master' : 'Player'}</p>
          <h3>{currentUser.username}</h3>

          <div className="save-row">
            <button type="button" className="primary-button" onClick={handleManualSave}>
              Save
            </button>
            <span className={`save-status ${saveStatus}`}>
              {saveStatus === 'saving' ? 'Saving...' : `Saved ${formatSavedTime(lastSavedAt)}`}
            </span>
          </div>

          <button type="button" className="ghost-button" onClick={exportCampaignToFile} style={{ marginTop: '0.75rem' }}>
            Export campaign
          </button>
          <label className="upload-button slim" style={{ marginTop: '0.75rem' }}>
            Import campaign
            <input type="file" accept="application/json" onChange={importCampaignFromFile} />
          </label>
          <button type="button" className="ghost-button" onClick={logout} style={{ marginTop: '0.75rem' }}>
            Switch campaign
          </button>
        </div>
      </aside>

      <main className="content-panel">
        {tab === 'characters' && (
          <section className="page-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Your roster</p>
                <h1>Character sheets</h1>
              </div>
              <div className="pill">{currentUser.characters.length} {currentUser.characters.length === 1 ? 'character' : 'characters'}</div>
            </div>

            <div className="content-grid">
              <form className="sheet-card" onSubmit={handleAddCharacter}>
                <h2>New character</h2>

                <div className="upload-row">
                  <div className="avatar-preview">
                    <img
                      src={
                        portraitPreview ||
                        getCharacterDisplayPortrait(selectedCharacter ?? { name: 'Character', color: '#7c3aed', portrait: '' })
                      }
                      alt="Character portrait preview"
                    />
                  </div>
                  <label className="upload-button">
                    Upload portrait
                    <input type="file" accept="image/*" onChange={handleCharacterPortrait} />
                  </label>
                </div>

                <div className="field-grid">
                  <label>
                    Name
                    <input value={characterForm.name} onChange={(event) => handleCharacterChange('name', event.target.value)} />
                  </label>
                  <label>
                    Race
                    <input value={characterForm.race} onChange={(event) => handleCharacterChange('race', event.target.value)} />
                  </label>
                  <label>
                    Class
                    <input value={characterForm.className} onChange={(event) => handleCharacterChange('className', event.target.value)} />
                  </label>
                  <label>
                    Subclass
                    <input value={characterForm.subclass} onChange={(event) => handleCharacterChange('subclass', event.target.value)} />
                  </label>
                  <label>
                    Level
                    <input type="number" min="1" max="20" value={characterForm.level} onChange={(event) => handleCharacterChange('level', event.target.value)} />
                  </label>
                  <label className="wide">
                    Background
                    <input value={characterForm.background} onChange={(event) => handleCharacterChange('background', event.target.value)} />
                  </label>
                </div>

                <div className="stat-grid">
                  {Object.entries(starterStats).map(([key]) => (
                    <label key={key}>
                      {key.slice(0, 3).toUpperCase()}
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={characterForm[key as keyof typeof starterStats]}
                        onChange={(event) =>
                          handleCharacterChange(key as keyof typeof emptyCharacterForm, event.target.value)
                        }
                      />
                    </label>
                  ))}
                </div>

                <label>
                  Notes
                  <textarea value={characterForm.notes} onChange={(event) => handleCharacterChange('notes', event.target.value)} />
                </label>

                <div className="form-actions">
                  <button type="submit" className="primary-button">
                    {editingCharacterId ? 'Update character' : 'Save character'}
                  </button>
                  {editingCharacterId && (
                    <button type="button" className="ghost-button" onClick={resetCharacterForm}>
                      Cancel edit
                    </button>
                  )}
                </div>
              </form>

              <div className="roster-list">
                {currentUser.characters.length === 0 ? (
                  <div className="empty-state">No characters yet. Add your first adventurer.</div>
                ) : (
                  currentUser.characters.map((character) => (
                    <button
                      type="button"
                      key={character.id}
                      className={`character-tile ${selectedCharacterId === character.id ? 'selected' : ''}`}
                      onClick={() => handleCharacterTileClick(character)}
                    >
                      <img src={getCharacterDisplayPortrait(character)} alt={character.name} />
                      <div>
                        <strong>{character.name}</strong>
                        <span>
                          {character.race} {character.className} {character.subclass ? `(${character.subclass})` : ''}
                        </span>
                        <small>Level {character.level}</small>
                      </div>
                      <span className="delete" onClick={(event) => { event.stopPropagation(); removeCharacter(character.id) }}>
                        Remove
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </section>
        )}

        {tab === 'battle' && (
          <section className="page-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Table play</p>
                <h1>Battle maps</h1>
              </div>
              <label className="upload-button slim">
                Upload map
                <input type="file" accept="image/*" onChange={handleBattleMapUpload} />
              </label>
            </div>

            <div className="battle-layout">
              <div className="toolbar-card">
                <h3>Uploaded battle maps</h3>
                {currentUser.battleMaps.length === 0 ? (
                  <p className="empty-text">No maps uploaded yet.</p>
                ) : (
                  currentUser.battleMaps.map((map) => (
                    <div key={map.id} className={`map-item ${selectedBattleMapId === map.id ? 'selected' : ''}`}>
                      <button type="button" onClick={() => setSelectedBattleMapId(map.id)}>
                        {map.name}
                      </button>
                      <span className="map-delete" onClick={() => removeBattleMap(map.id)}>Remove</span>
                    </div>
                  ))
                )}

                <div className="side-panel-section">
                  <h4>Characters</h4>
                  <div className="mini-list">
                    {currentUser.characters.length === 0 ? (
                      <p className="empty-text">No characters yet.</p>
                    ) : (
                      currentUser.characters.map((character) => (
                        <button
                          type="button"
                          key={character.id}
                          className={`mini-token ${selectedCharacterId === character.id ? 'selected' : ''}`}
                          onClick={() => {
                            setSelectedCharacterId(character.id)
                            setSelectedMonsterId(null)
                          }}
                        >
                          <img src={getCharacterDisplayPortrait(character)} alt={character.name} />
                          <span>{character.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div className="side-panel-section">
                  <h4>Monster / Creature</h4>
                  <form className="monster-form" onSubmit={handleAddMonster}>
                    <label>
                      Name
                      <input value={monsterForm.name} onChange={(event) => handleMonsterChange('name', event.target.value)} />
                    </label>
                    <label>
                      Size (squares)
                      <input type="number" min="1" max="12" value={monsterForm.sizeSquares} onChange={(event) => handleMonsterChange('sizeSquares', event.target.value)} />
                    </label>
                    <label className="upload-button slim">
                      Upload image
                      <input type="file" accept="image/*" onChange={handleMonsterUpload} />
                    </label>
                    {monsterPreview ? (
                      <div className="monster-preview-card">
                        <img className="monster-preview" src={monsterPreview} alt="Monster preview" />
                      </div>
                    ) : (
                      <div className="monster-preview-card empty-preview">
                        <span>No image</span>
                      </div>
                    )}
                    <button type="submit" className="primary-button">Add to library</button>
                  </form>
                </div>

                <div className="side-panel-section">
                  <h4>Monster / Creature Library</h4>
                  {currentUser.monsters.length === 0 ? (
                    <p className="empty-text">No monsters or creatures yet.</p>
                  ) : (
                    <div className="monster-library-list">
                      {currentUser.monsters.map((monster) => (
                        <div
                          key={monster.id}
                          className={`monster-library-item ${selectedMonsterId === monster.id ? 'selected' : ''}`}
                        >
                          <button
                            type="button"
                            className="monster-library-select"
                            onClick={() => {
                              setSelectedMonsterId(monster.id)
                              setSelectedCharacterId(null)
                            }}
                          >
                            <img src={getMonsterImage(monster)} alt={monster.name || 'Creature'} />
                            <div>
                              <strong>{monster.name}</strong>
                              <small>{monster.sizeSquares} square{monster.sizeSquares === 1 ? '' : 's'}</small>
                            </div>
                          </button>
                          <button
                            type="button"
                            className="library-remove"
                            onClick={() => removeMonster(monster.id)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedMonster && (
                    <div className="monster-preview-card selected-monster-preview">
                      <img src={getMonsterImage(selectedMonster)} alt={selectedMonster.name || 'Creature'} />
                      <div>
                        <strong>{selectedMonster.name}</strong>
                        <small>{selectedMonster.sizeSquares} square{selectedMonster.sizeSquares === 1 ? '' : 's'}</small>
                      </div>
                    </div>
                  )}

                  {selectedMonster && (
                    <div className="monster-editor">
                      <label>
                        Selected size
                        <input
                          type="number"
                          min="1"
                          max="12"
                          value={selectedMonster.sizeSquares}
                          onChange={(event) => updateMonsterSize(selectedMonster.id, Number(event.target.value) || 1)}
                        />
                      </label>
                      <div className="small-actions">
                        <button type="button" className="ghost-button" onClick={() => updateMonsterSize(selectedMonster.id, selectedMonster.sizeSquares - 1)}>
                          −
                        </button>
                        <button type="button" className="ghost-button" onClick={() => updateMonsterSize(selectedMonster.id, selectedMonster.sizeSquares + 1)}>
                          +
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {(selectedCharacterId || selectedBattlePlacementId) && (
                  <div className="side-panel-section selection-actions">
                    <button
                      type="button"
                      className="remove-token-button"
                      onClick={(event) => {
                        event.stopPropagation()
                        if (selectedCharacterId) {
                          removeCharacterFromBoard(selectedCharacterId)
                        }
                        if (selectedBattlePlacementId) {
                          removeMonsterPlacementFromBoard(selectedBattlePlacementId)
                        }
                      }}
                    >
                      Delete selected
                    </button>
                  </div>
                )}
              </div>

              {selectedBattleMap ? (
                <div className="battle-board-wrap">
                  <label className="grid-size-control">
                    <span>Grid square size <strong>{selectedBattleMap.cellSize || 48}px</strong></span>
                    <input
                      type="range"
                      min="28"
                      max="90"
                      step="2"
                      value={selectedBattleMap.cellSize || 48}
                      onChange={(event) => updateBattleMapCellSize(selectedBattleMap.id, Number(event.target.value))}
                      aria-label="Battle map grid square size"
                    />
                  </label>
                  <div
                    className="map-canvas"
                    style={{ aspectRatio: `${selectedBattleMap.columns} / ${selectedBattleMap.rows}` }}
                    onClick={handleBattleMapClick}
                    onPointerMove={handleBattleMapPointerMove}
                    onPointerUp={() => setDraggedToken(null)}
                    onPointerLeave={() => setDraggedToken(null)}
                  >
                  <img src={selectedBattleMap.image} alt={selectedBattleMap.name} />
                  <div
                    className="map-grid"
                    style={{
                      gridTemplateColumns: `repeat(${selectedBattleMap.columns}, minmax(0, 1fr))`,
                      gridTemplateRows: `repeat(${selectedBattleMap.rows}, minmax(0, 1fr))`,
                    }}
                  >
                    {Array.from({ length: selectedBattleMap.columns * selectedBattleMap.rows }).map((_, index) => (
                      <div key={index} className="map-cell" />
                    ))}
                  </div>

                  {currentUser.characters.map((character) => {
                    if (!selectedBattleMap || character.x < 0 || character.y < 0) {
                      return null
                    }

                    const left = ((character.x + 0.5) / selectedBattleMap.columns) * 100
                    const top = ((character.y + 0.5) / selectedBattleMap.rows) * 100

                    const hasPortrait = typeof character.portrait === 'string' && character.portrait.trim().length > 0

                    return (
                      <button
                        key={character.id}
                        type="button"
                        className="token character-token"
                        style={{
                          left: `${left}%`,
                          top: `${top}%`,
                          borderColor: selectedCharacterId === character.id ? '#fff' : 'transparent',
                          backgroundImage: hasPortrait ? `url(${character.portrait})` : 'none',
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }}
                        onPointerDown={(event) => {
                          event.stopPropagation()
                          setSelectedCharacterId(character.id)
                          setSelectedMonsterId(null)
                          setSelectedBattlePlacementId(null)
                          setDraggedToken({ type: 'character', id: character.id })
                        }}
                        onClick={(event) => {
                          event.stopPropagation()
                        }}
                        aria-label={character.name}
                      >
                        {!hasPortrait && (
                          <span aria-hidden="true" className="token-letter">
                            {getInitials(character.name).slice(0, 1)}
                          </span>
                        )}
                      </button>
                    )
                  })}

                  {selectedBattleMap.monsterPlacements.map((placement) => {
                    const monster = currentUser.monsters.find((entry) => entry.id === placement.monsterId)
                    if (!monster) {
                      return null
                    }

                    const sizePx = Math.max(32, selectedBattleMap.cellSize * Math.max(placement.sizeSquares, 1) * 0.9)
                    const left = ((placement.x + placement.sizeSquares / 2) / selectedBattleMap.columns) * 100
                    const top = ((placement.y + placement.sizeSquares / 2) / selectedBattleMap.rows) * 100

                    return (
                      <div
                        key={placement.id}
                        className="monster-token"
                        style={{
                          left: `${left}%`,
                          top: `${top}%`,
                          width: `${sizePx}px`,
                          height: `${sizePx}px`,
                          borderRadius: '50%',
                          backgroundImage: `url(${getMonsterImage(monster)})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          border: selectedBattlePlacementId === placement.id ? '3px solid #ef4444' : '3px solid #ef4444',
                          boxShadow: selectedBattlePlacementId === placement.id
                            ? '0 0 0 3px rgba(239, 68, 68, 0.28), 0 8px 18px rgba(15, 23, 42, 0.35)'
                            : '0 0 0 3px rgba(239, 68, 68, 0.28), 0 8px 18px rgba(15, 23, 42, 0.35)',
                        }}
                        onPointerDown={(event) => {
                          event.stopPropagation()
                          setSelectedBattlePlacementId(placement.id)
                          setSelectedMonsterId(null)
                          setDraggedToken({ type: 'monster', id: placement.id })
                        }}
                        onClick={(event) => {
                          event.stopPropagation()
                          setSelectedBattlePlacementId(placement.id)
                        }}
                      />
                    )
                  })}

                  </div>
                </div>
              ) : (
                <div className="empty-map">Add a map to start placing your party.</div>
              )}
            </div>
          </section>
        )}

        {tab === 'world' && (
          <section className="page-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Campaign view</p>
                <h1>World maps</h1>
              </div>
              <label className="upload-button slim">
                Upload world map
                <input type="file" accept="image/*" onChange={handleWorldMapUpload} />
              </label>
            </div>

            <div className="battle-layout">
              <div className="toolbar-card">
                <h3>World maps</h3>
                {currentUser.worldMaps.length === 0 ? (
                  <p className="empty-text">No world map uploaded yet.</p>
                ) : (
                  currentUser.worldMaps.map((map) => (
                    <button
                      type="button"
                      key={map.id}
                      className={`map-item ${selectedWorldMapId === map.id ? 'selected' : ''}`}
                      onClick={() => setSelectedWorldMapId(map.id)}
                    >
                      {map.name}
                    </button>
                  ))
                )}
              </div>

              {selectedWorldMap ? (
                <div
                  ref={worldMapCanvasRef}
                  className="map-canvas world-canvas"
                  onClick={addWorldPin}
                  onMouseMove={handleWorldMapDragMove}
                  onMouseUp={() => setIsDraggingWorldPin(false)}
                  onMouseLeave={() => setIsDraggingWorldPin(false)}
                >
                  <img src={selectedWorldMap.image} alt={selectedWorldMap.name} />
                  <button
                    type="button"
                    className="map-fullscreen-button"
                    onClick={(event) => {
                      event.stopPropagation()
                      void toggleWorldMapFullscreen()
                    }}
                    aria-label={isWorldMapFullscreen ? 'Exit fullscreen map' : 'View map fullscreen'}
                    title={isWorldMapFullscreen ? 'Exit fullscreen' : 'View fullscreen'}
                  >
                    {isWorldMapFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                  </button>
                  {selectedWorldMap.pin && (
                    <div
                      key={selectedWorldMap.pin.id}
                      className="world-pin"
                      onMouseDown={(event) => {
                        event.stopPropagation()
                        setIsDraggingWorldPin(true)
                      }}
                      onMouseUp={(event) => {
                        event.stopPropagation()
                        setIsDraggingWorldPin(false)
                      }}
                      style={{ left: `${selectedWorldMap.pin.x * 100}%`, top: `${selectedWorldMap.pin.y * 100}%`, background: selectedWorldMap.pin.color }}
                    />
                  )}
                </div>
              ) : (
                <div className="empty-map">Upload a world map and click anywhere to drop a red pin for a key location.</div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
