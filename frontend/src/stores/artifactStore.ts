import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Artifact, ArtifactType } from '@/types'

interface ArtifactState {
  artifacts: Artifact[]
  activeArtifactId: string | null
  isPanelOpen: boolean
  isFullscreen: boolean
  
  // Getters
  activeArtifact: Artifact | null
  
  // Actions
  addArtifact: (artifact: Omit<Artifact, 'id' | 'createdAt' | 'updatedAt'>) => Artifact
  updateArtifact: (id: string, content: string) => void
  deleteArtifact: (id: string) => void
  
  setActiveArtifact: (artifact: Artifact | null) => void
  openPanel: (artifact?: Artifact) => void
  closePanel: () => void
  toggleFullscreen: () => void
  
  getArtifactsByMessage: (messageId: string) => Artifact[]
  clearAll: () => void
}

const generateId = () => Math.random().toString(36).substring(2, 15)

export const useArtifactStore = create<ArtifactState>()(
  persist(
    (set, get) => ({
      artifacts: [],
      activeArtifactId: null,
      isPanelOpen: false,
      isFullscreen: false,

      get activeArtifact() {
        const state = get()
        return state.artifacts.find(a => a.id === state.activeArtifactId) || null
      },

      addArtifact: (artifact) => {
        const newArtifact: Artifact = {
          ...artifact,
          id: generateId(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        console.log('📦 [ArtifactStore] addArtifact called:', {
          title: newArtifact.title,
          type: newArtifact.type,
          id: newArtifact.id
        })

        set(state => ({
          artifacts: [...state.artifacts, newArtifact],
        }))

        console.log('   ✅ Artifact added to store. Total artifacts:', get().artifacts.length)

        return newArtifact
      },

      updateArtifact: (id: string, content: string) => {
        set(state => ({
          artifacts: state.artifacts.map(a =>
            a.id === id
              ? { ...a, content, updatedAt: new Date().toISOString() }
              : a
          ),
        }))
      },

      deleteArtifact: (id: string) => {
        set(state => ({
          artifacts: state.artifacts.filter(a => a.id !== id),
          activeArtifactId: state.activeArtifactId === id ? null : state.activeArtifactId,
          isPanelOpen: state.activeArtifactId === id ? false : state.isPanelOpen,
        }))
      },

      setActiveArtifact: (artifact: Artifact | null) => {
        set({
          activeArtifactId: artifact?.id || null,
          isPanelOpen: !!artifact,
        })
      },

      openPanel: (artifact?: Artifact) => {
        console.log('🔓 [ArtifactStore] openPanel called:', {
          artifactId: artifact?.id,
          currentActiveId: get().activeArtifactId,
          currentIsPanelOpen: get().isPanelOpen,
          totalArtifacts: get().artifacts.length
        })

        set({
          activeArtifactId: artifact?.id || get().activeArtifactId,
          isPanelOpen: true,
        })

        console.log('   ✅ Panel state updated:', {
          activeArtifactId: get().activeArtifactId,
          isPanelOpen: get().isPanelOpen
        })
      },

      closePanel: () => {
        set({
          isPanelOpen: false,
          isFullscreen: false,
        })
      },

      toggleFullscreen: () => {
        set(state => ({ isFullscreen: !state.isFullscreen }))
      },

      getArtifactsByMessage: (messageId: string) => {
        return get().artifacts.filter(a => a.messageId === messageId)
      },

      clearAll: () => set({ artifacts: [], activeArtifactId: null, isPanelOpen: false }),
    }),
    {
      name: 'rom-artifacts',
      partialize: (state) => ({
        artifacts: state.artifacts,
      }),
    }
  )
)
