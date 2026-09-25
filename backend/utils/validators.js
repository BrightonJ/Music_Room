const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const passwordRequirementMessage = "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a digit and a special character";
const usernameRegex = /^[A-Za-z0-9_]{3,20}$/;
const privacyLevels = ['public', 'friends', 'private'];
const editableProfileFields = ['first_name', 'last_name', 'birth_date', 'music_preferences'];

function isValidBirthDate(dateString) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false;
    const [y, m, d] = dateString.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d && date <= new Date();
}

module.exports = {
    emailRegex,
    passwordRegex,
    passwordRequirementMessage,
    usernameRegex,
    privacyLevels,
    editableProfileFields,
    isValidBirthDate,
};