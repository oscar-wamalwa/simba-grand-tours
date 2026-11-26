# Admin Dashboard Fix - Testimonies/Message Separation

## Task
Fix the logic in admin dashboard code so that client submissions are correctly filtered by category, ensuring that 'messages' only appear in the Messages section and 'testimonies' only appear in the Testimonies section without overlapping.

## Issue Identified
The inline `TestimoniesView` component in `AdminDashboard.jsx` is incorrectly using `api.messages.getAll()` (contact-messages endpoint) instead of `api.testimonials.getAll()` (testimonials endpoint).

## Fix Plan
1. [ ] Change TestimoniesView to use `api.testimonials.getAll()` instead of `api.messages.getAll()`
2. [ ] Update API calls for featured functionality to use testimonial endpoints
3. [ ] Update state variables from `messages`/`featuredMessages` to `testimonials`/`featuredTestimonials`
4. [ ] Update field references to use testimonial data structure

## Status
- [ ] TODO - Created tracking document
- [ ] IN PROGRESS - Fixing the TestimoniesView component
- [ ] DONE - Fix completed

