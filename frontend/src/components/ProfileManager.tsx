import React, { useRef, useState } from 'react';
import { useEditor } from '../context/EditorContext';
import { Upload, Download } from 'lucide-react';

export const ProfileManager = () => {
    const {
        profiles,
        activeProfileId,
        layoutMode,
        setLayoutMode,
        setActiveProfileId,
        createProfile,
        importProfile,
        exportProfile,
        updateProfileMeta,
        updateProfileLevel,
        updateProfileFieldAttributes
    } = useEditor();
    const [newProfileName, setNewProfileName] = useState('');
    const importRef = useRef<HTMLInputElement>(null);
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [wizardStep, setWizardStep] = useState(1);

    const activeProfile = profiles.find(profile => profile.id === activeProfileId) ?? null;

    const handleCreateProfile = () => {
        const name = newProfileName.trim() || `Profile ${profiles.length + 1}`;
        createProfile(name);
        setNewProfileName('');
    };

    const handleExport = () => {
        if (!activeProfileId) return;
        const profile = exportProfile(activeProfileId);
        if (!profile) return;
        const json = JSON.stringify(profile, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${profile.name.replace(/\s+/g, '_').toLowerCase()}.layout.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') return;
                const parsed = JSON.parse(text);
                importProfile(parsed);
            } catch (error) {
                console.error('Failed to import profile:', error);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const updateLevelField = (index: number, field: 'name' | 'path' | 'labelKey' | 'filterKey' | 'filterValues' | 'overridePaths', value: string) => {
        if (!activeProfileId) return;
        if (field === 'filterValues') {
            const values = value.split(',').map(item => item.trim()).filter(Boolean);
            updateProfileLevel(activeProfileId, index, { filterValues: values });
            return;
        }
        if (field === 'overridePaths') {
            const overrides = value.split(',').map(item => item.trim()).filter(Boolean);
            updateProfileLevel(activeProfileId, index, { overridePaths: overrides });
            return;
        }
        updateProfileLevel(activeProfileId, index, { [field]: value });
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <span>Layout Mode</span>
                <select
                    value={layoutMode}
                    onChange={(e) => setLayoutMode(e.target.value as 'auto' | 'profile')}
                    className="input-field text-[11px]"
                >
                    <option value="auto">Auto</option>
                    <option value="profile">Profile</option>
                </select>
            </div>

            <div className="flex items-center gap-2">
                <select
                    value={activeProfileId ?? ''}
                    onChange={(e) => setActiveProfileId(e.target.value || null)}
                    className="input-field text-xs flex-1"
                >
                    <option value="">Select Profile</option>
                    {profiles.map(profile => (
                        <option key={profile.id} value={profile.id}>{profile.name}</option>
                    ))}
                </select>
                <button
                    onClick={handleExport}
                    className="px-2 py-1 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50"
                    title="Export Profile"
                >
                    <Download className="w-3 h-3" />
                </button>
                <button
                    onClick={() => importRef.current?.click()}
                    className="px-2 py-1 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50"
                    title="Import Profile"
                >
                    <Upload className="w-3 h-3" />
                </button>
                <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
            </div>

            <button
                onClick={() => {
                    setWizardStep(1);
                    setIsWizardOpen(true);
                }}
                className="w-full px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
                Open Profile Wizard
            </button>

            <div className="flex items-center gap-2">
                <input
                    type="text"
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    className="input-field text-xs flex-1"
                    placeholder="New profile name"
                />
                <button
                    onClick={handleCreateProfile}
                    className="px-2 py-1 text-[11px] font-medium text-white bg-slate-900 rounded hover:bg-slate-800"
                >
                    Create
                </button>
            </div>

            {activeProfile && (
                <div className="space-y-2">
                    <div className="space-y-3">
                        {activeProfile.levels.map((level, index) => (
                            <div key={level.id} className="border border-slate-200 rounded-lg p-2 bg-white space-y-2">
                                <div className="text-[11px] font-semibold text-slate-500">{`Level ${index + 1}`}</div>
                                <input
                                    type="text"
                                    value={level.name}
                                    onChange={(e) => updateLevelField(index, 'name', e.target.value)}
                                    className="input-field text-xs w-full"
                                    placeholder="Level name"
                                />
                                <input
                                    type="text"
                                    value={level.path}
                                    onChange={(e) => updateLevelField(index, 'path', e.target.value)}
                                    className="input-field text-xs w-full"
                                    placeholder="Path (e.g., tabs[*])"
                                />
                                <input
                                    type="text"
                                    value={level.overridePaths?.join(', ') ?? ''}
                                    onChange={(e) => updateLevelField(index, 'overridePaths', e.target.value)}
                                    className="input-field text-xs w-full"
                                    placeholder="Override paths (comma separated)"
                                />
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="text"
                                        value={level.labelKey ?? ''}
                                        onChange={(e) => updateLevelField(index, 'labelKey', e.target.value)}
                                        className="input-field text-xs w-full"
                                        placeholder="Label key (e.g., name)"
                                    />
                                    <input
                                        type="text"
                                        value={level.filterKey ?? ''}
                                        onChange={(e) => updateLevelField(index, 'filterKey', e.target.value)}
                                        className="input-field text-xs w-full"
                                        placeholder="Filter key (e.g., type)"
                                    />
                                </div>
                                <input
                                    type="text"
                                    value={level.filterValues?.join(', ') ?? ''}
                                    onChange={(e) => updateLevelField(index, 'filterValues', e.target.value)}
                                    className="input-field text-xs w-full"
                                    placeholder="Filter values (comma separated)"
                                />
                            </div>
                        ))}
                        <input
                            type="text"
                            value={activeProfile.fieldAttributes.join(', ')}
                            onChange={(e) => updateProfileFieldAttributes(activeProfile.id, e.target.value.split(',').map(item => item.trim()).filter(Boolean))}
                            className="input-field text-xs w-full"
                            placeholder="Field attributes (comma separated)"
                        />
                    </div>
                </div>
            )}

            {isWizardOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-[520px] max-w-[90vw] overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800">Profile Wizard</h3>
                                <p className="text-[11px] text-slate-400">Step {wizardStep} of 3</p>
                            </div>
                            <button
                                onClick={() => setIsWizardOpen(false)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {wizardStep === 1 && (
                                <>
                                    <p className="text-sm text-slate-600">
                                        Create a profile to define how your JSON is grouped into tabs and sections.
                                    </p>
                                    <input
                                        type="text"
                                        value={newProfileName}
                                        onChange={(e) => setNewProfileName(e.target.value)}
                                        className="input-field w-full"
                                        placeholder="Profile name"
                                    />
                                    <button
                                        onClick={handleCreateProfile}
                                        className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg"
                                    >
                                        Create Profile
                                    </button>
                                </>
                            )}

                            {wizardStep === 2 && activeProfile && (
                                <>
                                    <p className="text-sm text-slate-600">
                                        Define how to walk your JSON: level names, paths, and filters.
                                    </p>
                                    <div className="space-y-3">
                                        {activeProfile.levels.map((level, index) => (
                                            <div key={level.id} className="border border-slate-200 rounded-lg p-3 space-y-2">
                                                <div className="text-xs font-semibold text-slate-500">Level {index + 1}</div>
                                                <input
                                                    type="text"
                                                    value={level.name}
                                                    onChange={(e) => updateLevelField(index, 'name', e.target.value)}
                                                    className="input-field text-sm w-full"
                                                    placeholder="Level name (Tabs, Sections, Fields)"
                                                />
                                                <input
                                                    type="text"
                                                    value={level.path}
                                                    onChange={(e) => updateLevelField(index, 'path', e.target.value)}
                                                    className="input-field text-sm w-full"
                                                    placeholder="Path (e.g., tabs[*])"
                                                />
                                                <input
                                                    type="text"
                                                    value={level.filterKey ?? ''}
                                                    onChange={(e) => updateLevelField(index, 'filterKey', e.target.value)}
                                                    className="input-field text-sm w-full"
                                                    placeholder="Filter key (e.g., type)"
                                                />
                                                <input
                                                    type="text"
                                                    value={level.filterValues?.join(', ') ?? ''}
                                                    onChange={(e) => updateLevelField(index, 'filterValues', e.target.value)}
                                                    className="input-field text-sm w-full"
                                                    placeholder="Filter values (comma separated)"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            {wizardStep === 3 && (
                                <>
                                    <p className="text-sm text-slate-600">
                                        Define the field attributes you want to surface (label, width, etc.).
                                    </p>
                                    {activeProfile && (
                                        <input
                                            type="text"
                                            value={activeProfile.fieldAttributes.join(', ')}
                                            onChange={(e) => updateProfileFieldAttributes(activeProfile.id, e.target.value.split(',').map(item => item.trim()).filter(Boolean))}
                                            className="input-field text-sm w-full"
                                            placeholder="Field attributes (comma separated)"
                                        />
                                    )}
                                </>
                            )}
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                            <button
                                onClick={() => setWizardStep(step => Math.max(1, step - 1))}
                                className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg"
                                disabled={wizardStep === 1}
                            >
                                Back
                            </button>
                            {wizardStep < 3 ? (
                                <button
                                    onClick={() => setWizardStep(step => Math.min(3, step + 1))}
                                    className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg"
                                >
                                    Next
                                </button>
                            ) : (
                                <button
                                    onClick={() => setIsWizardOpen(false)}
                                    className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg"
                                >
                                    Done
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
