import { useState } from 'react';
import { X, Upload } from 'lucide-react';
import api from '../api';

// Crop to a centred square and shrink so the photo stays small in the database.
async function prepareAvatar(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a JPEG, PNG, or WebP image.');
  }
  const source = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.readAsDataURL(file);
  });
  const image = new Image();
  image.src = source;
  await image.decode();
  const size = Math.min(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 320;
  const context = canvas.getContext('2d');
  context.drawImage(
    image,
    (image.naturalWidth - size) / 2, (image.naturalHeight - size) / 2, size, size,
    0, 0, 320, 320,
  );
  return canvas.toDataURL('image/jpeg', 0.85);
}

export default function ProfileModal({ profile, fallbackPhoto, onClose, onSaved }) {
  const [displayName, setDisplayName] = useState(profile.display_name || '');
  const [photo, setPhoto] = useState(profile.photo || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const choosePhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    try {
      setPhoto(await prepareAvatar(file));
    } catch (uploadError) {
      setError(uploadError.message);
    }
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const updated = await api.auth.updateProfile({ display_name: displayName.trim(), photo });
      onSaved(updated);
      onClose();
    } catch (saveError) {
      setError(saveError.message || 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay show" onClick={onClose}>
      <div className="modal" onClick={event => event.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit profile</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close profile editor"><X size={20} /></button>
        </div>
        <form className="modal-body" onSubmit={save}>
          <div className="profile-photo-edit">
            <img src={photo || fallbackPhoto} alt="Profile preview" />
            <div>
              <label className="btn-secondary profile-photo-button">
                <Upload size={14} /> Change photo
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} hidden />
              </label>
              {photo && <button type="button" className="btn-secondary" onClick={() => setPhoto('')}>Remove</button>}
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="profile-display-name">Display name</label>
            <input id="profile-display-name" value={displayName} maxLength={80} onChange={event => setDisplayName(event.target.value)} placeholder={profile.username || 'Admin'} />
          </div>
          {error && <p className="form-status error" role="alert">{error}</p>}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
