using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using lmsbox.infrastructure.Data;
using lmsbox.domain.Models;
using System.Security.Claims;

namespace lmsBox.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AdminLearningPathwaysController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public AdminLearningPathwaysController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetLearningPathways(
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var query = _context.LearningGroups
            .Include(lg => lg.Organisation)
            .Include(lg => lg.CreatedByUser)
            .Include(lg => lg.LearnerGroups)
            .Include(lg => lg.GroupCourses)
                .ThenInclude(gc => gc.Course)
            .AsQueryable();

        if (!string.IsNullOrEmpty(search))
        {
            query = query.Where(lg => lg.Name.Contains(search) || 
                                     (lg.Description != null && lg.Description.Contains(search)));
        }

        var totalCount = await query.CountAsync();
        
        var pathways = await query
            .OrderBy(lg => lg.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(lg => new
            {
                lg.Id,
                lg.Name,
                lg.Description,
                lg.CreatedAt,
                CreatedBy = lg.CreatedByUser!.UserName,
                MemberCount = lg.LearnerGroups.Count(learner => learner.IsActive),
                CourseCount = lg.GroupCourses.Count(),
                Courses = lg.GroupCourses.Select(gc => new
                {
                    gc.Course!.Id,
                    gc.Course.Title,
                    gc.AssignedAt
                }).ToList()
            })
            .ToListAsync();

        return Ok(new
        {
            items = pathways,
            totalCount,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
        });
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<object>> GetLearningPathway(long id)
    {
        var pathway = await _context.LearningGroups
            .Include(lg => lg.Organisation)
            .Include(lg => lg.CreatedByUser)
            .Include(lg => lg.LearnerGroups)
                .ThenInclude(learner => learner.User)
            .Include(lg => lg.GroupCourses)
                .ThenInclude(gc => gc.Course)
            .FirstOrDefaultAsync(lg => lg.Id == id);

        if (pathway == null)
        {
            return NotFound();
        }

        return Ok(new
        {
            id = pathway.Id,
            name = pathway.Name,
            description = pathway.Description,
            createdAt = pathway.CreatedAt,
            createdBy = pathway.CreatedByUser!.UserName,
            members = pathway.LearnerGroups
                .Where(learner => learner.IsActive)
                .Select(learner => new
                {
                    userId = learner.UserId,
                    userName = learner.User!.UserName,
                    email = learner.User.Email,
                    joinedAt = learner.JoinedAt
                }).ToList(),
            courses = pathway.GroupCourses.Select(gc => new
            {
                id = gc.Course!.Id,
                title = gc.Course.Title,
                description = gc.Course.Description,
                assignedAt = gc.AssignedAt,
                expiresAt = gc.ExpiresAt
            }).ToList()
        });
    }

    [HttpPost]
    public async Task<ActionResult<object>> CreateLearningPathway([FromBody] CreateLearningPathwayRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        // For now, we'll use organisation ID 1. In a real app, you'd get this from the user's context
        var organisationId = 1L;

        var pathway = new LearningGroup
        {
            Name = request.Name,
            Description = request.Description,
            OrganisationId = organisationId,
            CreatedByUserId = userId
        };

        _context.LearningGroups.Add(pathway);
        await _context.SaveChangesAsync();

        // Add courses if provided
        if (request.CourseIds?.Any() == true)
        {
            var groupCourses = request.CourseIds.Select(courseId => new GroupCourse
            {
                LearningGroupId = pathway.Id,
                CourseId = courseId
            }).ToList();

            _context.GroupCourses.AddRange(groupCourses);
            await _context.SaveChangesAsync();
        }

        // Add users if provided
        if (request.UserIds?.Any() == true)
        {
            var learnerGroups = request.UserIds.Select(userId => new LearnerGroup
            {
                LearningGroupId = pathway.Id,
                UserId = userId
            }).ToList();

            _context.LearnerGroups.AddRange(learnerGroups);
            await _context.SaveChangesAsync();
        }

        return CreatedAtAction(nameof(GetLearningPathway), new { id = pathway.Id }, new
        {
            pathway.Id,
            pathway.Name,
            pathway.Description,
            pathway.CreatedAt
        });
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> UpdateLearningPathway(long id, [FromBody] UpdateLearningPathwayRequest request)
    {
        var pathway = await _context.LearningGroups
            .Include(lg => lg.GroupCourses)
            .Include(lg => lg.LearnerGroups)
            .FirstOrDefaultAsync(lg => lg.Id == id);

        if (pathway == null)
        {
            return NotFound();
        }

        // Update basic properties
        pathway.Name = request.Name;
        pathway.Description = request.Description;

        // Update courses
        if (request.CourseIds != null)
        {
            // Remove existing courses
            _context.GroupCourses.RemoveRange(pathway.GroupCourses);

            // Add new courses
            var groupCourses = request.CourseIds.Select(courseId => new GroupCourse
            {
                LearningGroupId = pathway.Id,
                CourseId = courseId
            }).ToList();

            _context.GroupCourses.AddRange(groupCourses);
        }

        // Update users
        if (request.UserIds != null)
        {
            // Remove existing active memberships
            var existingMemberships = pathway.LearnerGroups.Where(lg => lg.IsActive);
            foreach (var membership in existingMemberships)
            {
                membership.IsActive = false;
            }

            // Add new memberships
            var learnerGroups = request.UserIds.Select(userId => new LearnerGroup
            {
                LearningGroupId = pathway.Id,
                UserId = userId
            }).ToList();

            _context.LearnerGroups.AddRange(learnerGroups);
        }

        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteLearningPathway(long id)
    {
        var pathway = await _context.LearningGroups.FindAsync(id);

        if (pathway == null)
        {
            return NotFound();
        }

        _context.LearningGroups.Remove(pathway);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}

public class CreateLearningPathwayRequest
{
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public List<string>? CourseIds { get; set; }
    public List<string>? UserIds { get; set; }
}

public class UpdateLearningPathwayRequest
{
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public List<string>? CourseIds { get; set; }
    public List<string>? UserIds { get; set; }
}