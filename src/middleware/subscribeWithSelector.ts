import {
  State,
  StateCreator,
  StateListener,
  StoreMutatorIdentifier,
  Subscribe,
} from '../vanilla'

type SubscribeWithSelector = <
  T extends State,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
  initializer: StateCreator<
    T,
    [...Mps, ['zustand/subscribeWithSelector', never]],
    Mcs
  >
) => StateCreator<T, Mps, [['zustand/subscribeWithSelector', never], ...Mcs]>

type Write<T extends object, U extends object> = Omit<T, keyof U> & U
type Cast<T, U> = T extends U ? T : U

type WithSelectorSubscribe<S> = S extends { getState: () => infer T }
  ? Write<S, StoreSubscribeWithSelector<Cast<T, State>>>
  : never

declare module '../vanilla' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface StoreMutators<S, A> {
    ['zustand/subscribeWithSelector']: WithSelectorSubscribe<S>
  }
}

interface StoreSubscribeWithSelector<T extends State> {
  subscribe: {
    (listener: (selectedState: T, previousSelectedState: T) => void): () => void
    <U>(
      selector: (state: T) => U,
      listener: (selectedState: U, previousSelectedState: U) => void,
      options?: {
        equalityFn?: (a: U, b: U) => boolean
        fireImmediately?: boolean
      }
    ): () => void
  }
}

type SubscribeWithSelectorImpl = <T extends State>(
  storeInitializer: PopArgument<StateCreator<T, [], []>>
) => PopArgument<StateCreator<T, [], []>>

type PopArgument<T extends (...a: never[]) => unknown> = T extends (
  ...a: [...infer A, infer _]
) => infer R
  ? (...a: A) => R
  : never

const subscribeWithSelectorImpl: SubscribeWithSelectorImpl =
  (fn) => (set, get, api) => {
    type S = ReturnType<typeof fn>
    const origSubscribe = api.subscribe as Subscribe<S>
    api.subscribe = ((selector: any, optListener: any, options: any) => {
      let listener: StateListener<S> = selector // if no selector
      if (optListener) {
        const equalityFn = options?.equalityFn || Object.is
        let currentSlice = selector(api.getState())
        listener = (state) => {
          const nextSlice = selector(state)
          if (!equalityFn(currentSlice, nextSlice)) {
            const previousSlice = currentSlice
            optListener((currentSlice = nextSlice), previousSlice)
          }
        }
        if (options?.fireImmediately) {
          optListener(currentSlice, currentSlice)
        }
      }
      return origSubscribe(listener)
    }) as any
    const initialState = fn(set, get, api)
    return initialState
  }
export const subscribeWithSelector =
  subscribeWithSelectorImpl as unknown as SubscribeWithSelector