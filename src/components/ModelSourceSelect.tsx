'use client';

import { Listbox, ListboxButton, ListboxOption, ListboxOptions, Transition } from '@headlessui/react';
import { Check, ChevronDown } from 'lucide-react';
import { Fragment } from 'react';
import { ModelSourceOption } from '@/domain/modelSource';

interface ModelSourceSelectProps {
  label: string;
  options: ModelSourceOption[];
  value: ModelSourceOption;
  onChange: (option: ModelSourceOption) => void;
  kindLabels: {
    base: string;
    lora: string;
  };
}

const tagClassByKind: Record<ModelSourceOption['kind'], string> = {
  base: 'border-cyan-800 bg-cyan-950/60 text-cyan-300',
  lora: 'border-amber-800 bg-amber-950/60 text-amber-300',
};

export default function ModelSourceSelect({
  label,
  options,
  value,
  onChange,
  kindLabels,
}: ModelSourceSelectProps) {
  return (
    <div className="block">
      <div className="mb-2 text-sm font-medium text-gray-300">{label}</div>
      <Listbox value={value} by="id" onChange={onChange}>
        <div className="relative">
          <ListboxButton className="flex w-full items-center gap-3 rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-left outline-none transition focus:border-blue-500">
            <div className="min-w-0 flex-1">
              <div className="truncate text-base text-gray-100">{value.label}</div>
            </div>
            <TypeTag kind={value.kind} kindLabels={kindLabels} />
            <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
          </ListboxButton>
          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <ListboxOptions anchor="bottom" className="z-30 mt-2 max-h-80 w-[var(--button-width)] overflow-auto rounded-xl border border-gray-800 bg-gray-950 p-1.5 shadow-2xl outline-none [--anchor-gap:8px]">
              {options.map(option => (
                <ListboxOption
                  key={option.id}
                  value={option}
                  className={({ active }) =>
                    `cursor-pointer rounded-lg px-3 py-3 transition ${
                      active ? 'bg-gray-900 text-white' : 'text-gray-200'
                    }`
                  }
                >
                  {({ selected }) => (
                    <div className="flex items-start gap-3">
                      <div className="flex min-w-0 flex-1 items-start gap-2">
                        {selected ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" /> : <span className="mt-0.5 h-4 w-4 shrink-0" />}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-gray-100">{option.label}</div>
                        </div>
                      </div>
                      <TypeTag kind={option.kind} kindLabels={kindLabels} />
                    </div>
                  )}
                </ListboxOption>
              ))}
            </ListboxOptions>
          </Transition>
        </div>
      </Listbox>
    </div>
  );
}

function TypeTag({
  kind,
  kindLabels,
}: {
  kind: ModelSourceOption['kind'];
  kindLabels: ModelSourceSelectProps['kindLabels'];
}) {
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${tagClassByKind[kind]}`}
    >
      {kind === 'base' ? kindLabels.base : kindLabels.lora}
    </span>
  );
}
